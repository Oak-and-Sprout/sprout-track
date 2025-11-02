'use client';

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Crown,
  Calendar,
  X
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { PaymentModalProps, PricingPlan, SubscriptionStatus } from './payment-modal.types';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

/**
 * PaymentModal Component
 *
 * Handles subscription management and payment processing through Stripe.
 * Displays pricing plans, allows users to subscribe or purchase lifetime access,
 * and manages existing subscriptions.
 */
const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  accountStatus,
  onPaymentSuccess,
}) => {
  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);

  // Pricing plans configuration
  const pricingPlans: PricingPlan[] = [
    {
      id: 'monthly',
      name: 'Monthly',
      description: 'Perfect for trying out Sprout Track',
      price: 2.00,
      interval: 'month',
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID || '',
      features: [
        'Unlimited babies and caretakers',
        'Track all activities',
        'Calendar and reminders',
        'Medicine tracking',
        'Data export',
        'Mobile-friendly interface'
      ]
    },
    {
      id: 'lifetime',
      name: 'Lifetime',
      description: 'One-time payment, lifetime access',
      price: 12.00,
      interval: 'lifetime',
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID || '',
      highlighted: true,
      features: [
        'Everything in Monthly',
        'Lifetime updates',
        'No recurring payments',
        'Priority support forever',
        'Best long-term value'
      ]
    }
  ];

  // Fetch subscription status when modal opens
  useEffect(() => {
    if (isOpen && accountStatus.subscriptionActive && accountStatus.subscriptionId) {
      fetchSubscriptionStatus();
    }
  }, [isOpen, accountStatus.subscriptionId]);

  // Fetch current subscription details
  const fetchSubscriptionStatus = async () => {
    setLoadingStatus(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/accounts/payments/subscription-status', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setSubscriptionStatus(data.data);
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error);
    } finally {
      setLoadingStatus(false);
    }
  };

  // Handle plan selection and redirect to Stripe Checkout
  const handleSelectPlan = async (plan: PricingPlan) => {
    if (!plan.stripePriceId) {
      setError('Pricing configuration error. Please contact support.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/accounts/payments/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          priceId: plan.stripePriceId,
          planType: plan.interval === 'lifetime' ? 'full' : 'sub'
        })
      });

      const data = await response.json();

      if (data.success && data.data.url) {
        // Redirect to Stripe Checkout URL
        window.location.href = data.data.url;
      } else if (data.success && data.data.sessionId) {
        // Fallback: use legacy redirectToCheckout if URL not provided
        const stripe = await stripePromise;
        if (!stripe) {
          throw new Error('Stripe failed to load');
        }

        // Use type assertion to access the method
        await (stripe as any).redirectToCheckout({
          sessionId: data.data.sessionId
        });
      } else {
        setError(data.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setError('Failed to start checkout process. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle subscription cancellation
  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will still have access until the end of your current billing period.')) {
      return;
    }

    setCancelingSubscription(true);
    setError(null);

    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/accounts/payments/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();

      if (data.success) {
        await fetchSubscriptionStatus();
        onPaymentSuccess(); // Refresh parent data
      } else {
        setError(data.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      setError('Failed to cancel subscription. Please try again.');
    } finally {
      setCancelingSubscription(false);
    }
  };

  // Render subscription management section for active subscribers
  const renderSubscriptionManagement = () => {
    if (loadingStatus) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      );
    }

    if (!subscriptionStatus) {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-teal-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-teal-800 mb-2">
                Active {accountStatus.planType === 'full' ? 'Lifetime' : 'Subscription'}
              </h4>

              {accountStatus.planType === 'sub' && subscriptionStatus.currentPeriodEnd && (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-teal-700">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {subscriptionStatus.cancelAtPeriodEnd ? 'Expires' : 'Renews'} on{' '}
                      {new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()}
                    </span>
                  </div>

                  {subscriptionStatus.paymentMethod && (
                    <div className="flex items-center gap-2 text-teal-700">
                      <CreditCard className="h-4 w-4" />
                      <span>
                        {subscriptionStatus.paymentMethod.brand.toUpperCase()} ending in{' '}
                        {subscriptionStatus.paymentMethod.last4}
                      </span>
                    </div>
                  )}

                  {subscriptionStatus.cancelAtPeriodEnd && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                      <div className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">Subscription Cancelled</span>
                      </div>
                      <p className="text-sm text-amber-600 mt-1">
                        You will have access until {new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {accountStatus.planType === 'full' && (
                <p className="text-teal-700">
                  You have lifetime access to all features. Thank you for your support!
                </p>
              )}
            </div>
          </div>
        </div>

        {accountStatus.planType === 'sub' && !subscriptionStatus.cancelAtPeriodEnd && (
          <div className="flex justify-end">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancelSubscription}
              disabled={cancelingSubscription}
            >
              {cancelingSubscription ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Cancel Subscription'
              )}
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Render pricing plans for selection
  const renderPricingPlans = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {pricingPlans.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              "relative border rounded-lg p-6 flex flex-col",
              plan.highlighted
                ? "border-teal-500 shadow-lg bg-teal-50"
                : "border-gray-200 bg-white"
            )}
          >
            {plan.highlighted && (
              <div className="absolute top-0 right-0 bg-teal-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                BEST VALUE
              </div>
            )}

            <div className="flex-1">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-600">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                {plan.interval !== 'lifetime' && (
                  <span className="text-gray-600">/{plan.interval}</span>
                )}
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle className="h-4 w-4 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Button
              onClick={() => handleSelectPlan(plan)}
              disabled={loading}
              variant={plan.highlighted ? "default" : "outline"}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Crown className="h-4 w-4 mr-2" />
                  Select Plan
                </>
              )}
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            {accountStatus.subscriptionActive ? 'Manage Subscription' : 'Choose Your Plan'}
          </DialogTitle>
          <DialogDescription>
            {accountStatus.subscriptionActive
              ? 'View and manage your current subscription'
              : 'Select the plan that works best for you'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          )}

          {accountStatus.planType === 'full'
            ? renderSubscriptionManagement()
            : accountStatus.subscriptionActive && accountStatus.planType === 'sub' && accountStatus.subscriptionId
            ? renderSubscriptionManagement()
            : renderPricingPlans()}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
