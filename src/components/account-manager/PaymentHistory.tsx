import React, { useState, useEffect } from 'react';
import { cn } from '@/src/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import { Button } from '@/src/components/ui/button';
import {
  Loader2,
  Receipt,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import './account-manager.css';

/**
 * Payment history transaction data
 */
interface PaymentTransaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  receiptUrl?: string;
  invoiceUrl?: string;
}

/**
 * Props for the PaymentHistory component
 */
interface PaymentHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * PaymentHistory Component
 *
 * Displays a modal with a table of payment transactions from Stripe.
 * Shows transaction date, amount, status, description, and links to receipts/invoices.
 */
const PaymentHistory: React.FC<PaymentHistoryProps> = ({ isOpen, onClose }) => {
  // State management
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Fetch payment history when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchPaymentHistory();
    }
  }, [isOpen]);

  /**
   * Fetch payment history from API
   */
  const fetchPaymentHistory = async (startingAfter?: string) => {
    setLoading(true);
    setError(null);

    try {
      const authToken = localStorage.getItem('authToken');
      const url = new URL('/api/accounts/payments/payment-history', window.location.origin);
      url.searchParams.set('limit', '20');
      if (startingAfter) {
        url.searchParams.set('starting_after', startingAfter);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();

      if (data.success) {
        if (startingAfter) {
          // Append to existing transactions for pagination
          setTransactions(prev => [...prev, ...data.data.transactions]);
        } else {
          // Replace transactions for initial load
          setTransactions(data.data.transactions);
        }
        setHasMore(data.data.hasMore);
      } else {
        setError(data.error || 'Failed to fetch payment history');
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
      setError('Failed to fetch payment history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load more transactions (pagination)
   */
  const loadMore = () => {
    if (transactions.length > 0) {
      const lastTransaction = transactions[transactions.length - 1];
      fetchPaymentHistory(lastTransaction.id);
    }
  };

  /**
   * Format transaction date for display
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  /**
   * Format amount for display
   */
  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  /**
   * Get status badge styling
   */
  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();

    let badgeClass = 'px-2 py-1 rounded-full text-xs font-medium';

    switch (statusLower) {
      case 'succeeded':
        badgeClass += ' bg-green-100 text-green-700';
        break;
      case 'processing':
        badgeClass += ' bg-blue-100 text-blue-700';
        break;
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        badgeClass += ' bg-yellow-100 text-yellow-700';
        break;
      case 'canceled':
      case 'failed':
        badgeClass += ' bg-red-100 text-red-700';
        break;
      default:
        badgeClass += ' bg-gray-100 text-gray-700';
    }

    return (
      <span className={badgeClass}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className={cn("text-2xl font-bold text-gray-900", "payment-history-title")}>
            Payment History
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {error && (
            <div className={cn("mb-4 p-4 bg-red-50 border border-red-200 rounded-lg", "payment-history-error")}>
              <div className={cn("flex items-center gap-2 text-red-700", "payment-history-error-text")}>
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Error</span>
              </div>
              <p className={cn("text-sm text-red-600 mt-1", "payment-history-error-description")}>{error}</p>
            </div>
          )}

          {loading && transactions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={cn("h-8 w-8 animate-spin text-teal-600", "payment-history-loading")} />
            </div>
          ) : transactions.length === 0 ? (
            <div className={cn("flex flex-col items-center justify-center py-12 text-gray-500", "payment-history-empty")}>
              <Receipt className="h-12 w-12 mb-3" />
              <p className="text-lg font-medium">No payment history</p>
              <p className="text-sm">You haven't made any payments yet.</p>
            </div>
          ) : (
            <>
              <div className={cn("rounded-lg border border-gray-200 overflow-hidden", "payment-history-table-container")}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Description</TableHead>
                      <TableHead className="font-semibold">Amount</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(transaction.date)}
                        </TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell className="whitespace-nowrap font-medium">
                          {formatAmount(transaction.amount, transaction.currency)}
                        </TableCell>
                        <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {hasMore && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <div className={cn("flex justify-end pt-4 border-t", "payment-history-footer")}>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentHistory;
