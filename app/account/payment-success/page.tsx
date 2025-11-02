'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, Home } from 'lucide-react';
import { Button } from '@/src/components/ui/button';

/**
 * Payment Success Page
 *
 * Displayed after successful Stripe Checkout completion.
 * Shows confirmation and redirects user back to their account.
 */
export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [countdown, setCountdown] = useState(5);

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
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Payment Successful!
          </h1>

          <p className="text-lg text-gray-600 mb-6">
            Thank you for your purchase. Your subscription has been activated.
          </p>

          {sessionId && (
            <p className="text-sm text-gray-500 mb-6">
              Confirmation ID: {sessionId.substring(0, 20)}...
            </p>
          )}

          {/* Countdown */}
          <div className="bg-teal-50 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-center mb-4">
              <div className="text-4xl font-bold text-teal-600">
                {countdown}
              </div>
            </div>
            <p className="text-teal-700 font-medium mb-3">
              Redirecting to your account in {countdown} second{countdown !== 1 ? 's' : ''}...
            </p>
            <div className="w-full bg-teal-200 rounded-full h-3">
              <div
                className="bg-teal-600 h-3 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${((5 - countdown) / 5) * 100}%` }}
              />
            </div>
          </div>

          {/* Manual Navigation */}
          <Button
            onClick={() => router.push('/account')}
            className="w-full"
          >
            <Home className="h-4 w-4 mr-2" />
            Go to Account Now
          </Button>
        </div>
      </div>
    </div>
  );
}
