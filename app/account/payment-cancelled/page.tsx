'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { XCircle, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/src/components/ui/button';

/**
 * Payment Cancelled Page
 *
 * Displayed when user cancels the Stripe Checkout process.
 * Provides options to return to account or try again.
 */
export default function PaymentCancelledPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    // Start countdown to redirect
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          router.push('/account');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center">
          {/* Cancel Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gray-400 rounded-full flex items-center justify-center">
              <XCircle className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Cancel Message */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Payment Cancelled
          </h1>

          <p className="text-lg text-gray-600 mb-6">
            Your payment was cancelled. No charges were made to your account.
          </p>

          <p className="text-gray-500 mb-8">
            If you experienced any issues during checkout or have questions about our pricing,
            please don't hesitate to reach out to our support team.
          </p>

          {/* Countdown */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-gray-700 font-medium">
              Redirecting to your account in {countdown} second{countdown !== 1 ? 's' : ''}...
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div
                className="bg-gray-600 h-2 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${((10 - countdown) / 10) * 100}%` }}
              />
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => router.push('/account')}
              className="w-full"
            >
              <Home className="h-4 w-4 mr-2" />
              Return to Account
            </Button>

            <Button
              onClick={() => router.back()}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
