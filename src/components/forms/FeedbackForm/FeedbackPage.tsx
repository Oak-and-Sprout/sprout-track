'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { 
  FormPage,
  FormPageFooter,
} from '@/src/components/ui/form-page';
import type { FormPageTab } from '@/src/components/ui/form-page/form-page.types';
import { Button } from '@/src/components/ui/button';
import { MessageSquare, Plus } from 'lucide-react';
import FeedbackMessagesView from './FeedbackMessagesView';
import FeedbackForm from './index';
import { useTheme } from '@/src/context/theme';

interface FeedbackPageProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FeedbackPage({
  isOpen,
  onClose,
}: FeedbackPageProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('messages');
  const [showNewFeedbackForm, setShowNewFeedbackForm] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const prevActiveTabRef = React.useRef<string | null>(null);

  const formatDateTime = useCallback((dateString: string | null): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, []);

  const handleNewFeedbackSuccess = useCallback(() => {
    setShowNewFeedbackForm(false);
    setActiveTab('messages');
    // Trigger refresh of messages view
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const handleFeedbackFormClose = useCallback(() => {
    setShowNewFeedbackForm(false);
    if (activeTab === 'new') {
      setActiveTab('messages');
    }
  }, [activeTab]);

  // Refresh messages when switching TO messages tab (not on initial mount)
  React.useEffect(() => {
    // Only trigger refresh if we're switching TO messages tab from another tab
    if (activeTab === 'messages' && prevActiveTabRef.current !== null && prevActiveTabRef.current !== 'messages') {
      setRefreshTrigger(prev => prev + 1);
    }
    // Update the previous tab reference
    prevActiveTabRef.current = activeTab;
  }, [activeTab]);

  // Memoize the tabs array to prevent recreating FeedbackMessagesView on every render
  // This prevents duplicate API calls when FamilyProvider causes re-renders
  const tabs: FormPageTab[] = useMemo(() => [
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageSquare,
      content: (
        <FeedbackMessagesView 
          formatDateTime={formatDateTime} 
          refreshTrigger={refreshTrigger}
          isPageOpen={isOpen}
        />
      ),
    },
    {
      id: 'new',
      label: 'New Feedback',
      icon: Plus,
      content: (
        <FeedbackForm
          isOpen={true}
          onClose={handleFeedbackFormClose}
          onSuccess={handleNewFeedbackSuccess}
          embedded={true}
        />
      ),
    },
  ], [formatDateTime, refreshTrigger, isOpen, handleNewFeedbackSuccess, handleFeedbackFormClose]);

  // If showing new feedback form, switch to that tab
  React.useEffect(() => {
    if (showNewFeedbackForm && activeTab !== 'new') {
      setActiveTab('new');
    }
  }, [showNewFeedbackForm]);

  return (
    <>
      <FormPage
        isOpen={isOpen}
        onClose={onClose}
        title="Feedback"
        description="View your messages and submit new feedback"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {activeTab === 'messages' && (
          <FormPageFooter>
            <div className="flex justify-end w-full">
              <Button
                onClick={onClose}
                variant="outline"
              >
                Close
              </Button>
            </div>
          </FormPageFooter>
        )}
        {activeTab === 'new' && (
          <FormPageFooter>
            <div className="flex justify-end w-full">
              <Button
                onClick={() => {
                  setShowNewFeedbackForm(false);
                  setActiveTab('messages');
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </FormPageFooter>
        )}
      </FormPage>
    </>
  );
}

