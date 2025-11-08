export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountStatus: {
    accountStatus: string;
    planType: string | null;
    subscriptionActive: boolean;
    trialEnds: string | null;
    planExpires: string | null;
    subscriptionId: string | null;
  };
  onPaymentSuccess: () => void;
}

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year' | 'lifetime';
  features: string[];
  highlighted?: boolean;
  stripePriceId: string;
}

export interface SubscriptionStatus {
  isActive: boolean;
  planType: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  paymentMethod?: {
    brand: string;
    last4: string;
  };
}
