'use client';

import React from 'react';
import { Button } from '@/src/components/ui/button';
import { AlertTriangle, Crown } from 'lucide-react';
import Image from 'next/image';

interface ExpiredAccountMessageProps {
  familyName?: string;
  familySlug?: string;
  isTrialExpired?: boolean;
  expirationDate?: string;
}

export default function ExpiredAccountMessage({
  familyName,
  familySlug,
  isTrialExpired = false,
  expirationDate
}: ExpiredAccountMessageProps) {

  const handleUpgradeClick = () => {
    // Navigate to home page with login modal
    const homeUrl = `/?upgrade=true&family=${encodeURIComponent(familySlug || '')}`;
    window.location.href = homeUrl;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="w-full max-w-md mx-auto p-6 text-center">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 p-1 flex items-center justify-center">
            <Image
              src="/sprout-128.png"
              alt="Sprout Logo"
              width={128}
              height={128}
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {isTrialExpired ? 'Trial Expired' : 'Subscription Expired'}
        </h2>

        {/* Family Name */}
        {familyName && (
          <p className="text-lg text-gray-700 mb-4">
            Access to <strong>{familyName}</strong> is currently suspended
          </p>
        )}

        {/* Expiration Details */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 text-sm">
            {isTrialExpired
              ? 'Your free trial expired'
              : 'Your subscription expired'
            }
            {expirationDate && (
              <span> on {new Date(expirationDate).toLocaleDateString()}</span>
            )}
          </p>
        </div>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          To continue tracking your family's activities, please log in to your account
          and {isTrialExpired ? 'upgrade to a full plan' : 'renew your subscription'}.
        </p>

        {/* Action Button */}
        <Button
          onClick={handleUpgradeClick}
          size="lg"
          className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
        >
          <Crown className="w-5 h-5 mr-2" />
          {isTrialExpired ? 'Upgrade Account' : 'Renew Subscription'}
        </Button>

        {/* Support Text */}
        <p className="text-xs text-gray-500 mt-4">
          Need help? Contact support for assistance with your account.
        </p>
      </div>
    </div>
  );
}