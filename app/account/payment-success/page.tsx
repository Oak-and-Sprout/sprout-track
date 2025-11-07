'use client';

import React, { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Home, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent } from '@/src/components/ui/card';
import { Label } from '@/src/components/ui/label';
import '../account.css';

/**
 * Payment Success Content Component
 * 
 * Handles the payment verification and countdown logic.
 * Separated to allow Suspense boundary wrapping.
 */
function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [countdown, setCountdown] = useState(5);
  const [verifying, setVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Get redirect URL based on family slug from JWT token
  const getRedirectUrl = useCallback((): string => {
    try {
      const authToken = localStorage.getItem('authToken');
      if (authToken) {
        const payload = authToken.split('.')[1];
        const decodedPayload = JSON.parse(atob(payload));
        const familySlug = decodedPayload.familySlug;
        
        // If we have a family slug, redirect to the family's log-entry page
        if (familySlug) {
          return `/${familySlug}/log-entry`;
        }
      }
    } catch (error) {
      console.error('Error parsing JWT token for redirect:', error);
    }
    
    // Fallback to home page if no family slug found
    return '/';
  }, []);

  // Verify the payment session on mount
  useEffect(() => {
    const verifySession = async () => {
      if (!sessionId) {
        setVerificationError('No session ID provided');
        setVerifying(false);
        return;
      }

      try {
        const authToken = localStorage.getItem('authToken');
        const response = await fetch('/api/accounts/payments/verify-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ sessionId })
        });

        const data = await response.json();

        if (!data.success) {
          setVerificationError(data.error || 'Failed to verify payment');
        }
      } catch (error) {
        console.error('Error verifying session:', error);
        setVerificationError('Failed to verify payment');
      } finally {
        setVerifying(false);
      }
    };

    verifySession();
  }, [sessionId]);

  useEffect(() => {
    // Only start countdown after verification is complete
    if (verifying) {
      return;
    }

    // Start countdown to redirect
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [verifying]);

  // Separate effect to handle redirect when countdown reaches 0
  useEffect(() => {
    if (countdown === 0) {
      router.push(getRedirectUrl());
    }
  }, [countdown, router, getRedirectUrl]);

  return (
    <div className="payment-success-layout min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="text-center pt-8">
          {/* Verification Status */}
          {verifying ? (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-teal-600 animate-spin" />
                </div>
              </div>
              <Label className="text-3xl font-bold text-gray-900 mb-4 block">
                Verifying Payment...
              </Label>
              <p className="text-lg text-gray-600 mb-6">
                Please wait while we confirm your payment.
              </p>
            </>
          ) : verificationError ? (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-12 h-12 text-amber-600" />
                </div>
              </div>
              <Label className="text-3xl font-bold text-gray-900 mb-4 block">
                Payment Verification Issue
              </Label>
              <p className="text-lg text-gray-600 mb-6">
                {verificationError}
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Your payment was processed, but we encountered an issue activating your account.
                Please contact support or try logging out and back in.
              </p>
            </>
          ) : (
            <>
              {/* Success Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-12 h-12 text-white" />
                </div>
              </div>

              {/* Success Message */}
              <Label className="text-3xl font-bold text-gray-900 mb-4 block">
                Payment Successful!
              </Label>

              <p className="text-lg text-gray-600 mb-6">
                Thank you for your purchase. Your subscription has been activated.
              </p>

              {sessionId && (
                <p className="text-sm text-gray-500 mb-6">
                  Confirmation ID: {sessionId.substring(0, 20)}...
                </p>
              )}
            </>
          )}

          {/* Countdown - only show after verification */}
          {!verifying && (
            <>
              <div className="bg-teal-50 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="text-4xl font-bold text-teal-600">
                    {countdown}
                  </div>
                </div>
                <p className="text-teal-700 font-medium mb-3">
                  Redirecting to home in {countdown} second{countdown !== 1 ? 's' : ''}...
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
                onClick={() => router.push(getRedirectUrl())}
                className="w-full"
              >
                <Home className="h-4 w-4 mr-2" />
                Go to Home Now
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Payment Success Page
 *
 * Displayed after successful Stripe Checkout completion.
 * Shows confirmation and redirects user back to their account.
 * 
 * Wrapped in Suspense to handle useSearchParams() requirement.
 */
export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="payment-success-layout min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="text-center pt-8">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-teal-600 animate-spin" />
                </div>
              </div>
              <Label className="text-3xl font-bold text-gray-900 mb-4 block">
                Loading...
              </Label>
            </CardContent>
          </Card>
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
