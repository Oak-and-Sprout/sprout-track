'use client';

import React, { useState } from 'react';
import { 
  FormPage, 
  FormPageContent, 
  FormPageFooter,
  FormPageTab
} from '@/src/components/ui/form-page';
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

  const formatDateTime = (dateString: string | null): string => {
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
  };

  const handleNewFeedbackSuccess = () => {
    setShowNewFeedbackForm(false);
    setActiveTab('messages');
    // Trigger refresh of messages view
    setRefreshTrigger(prev => prev + 1);
  };

  // Refresh messages when switching to messages tab
  React.useEffect(() => {
    if (activeTab === 'messages') {
      setRefreshTrigger(prev => prev + 1);
    }
  }, [activeTab]);

  const tabs: FormPageTab[] = [
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageSquare,
      content: (
        <FeedbackMessagesView formatDateTime={formatDateTime} refreshTrigger={refreshTrigger} />
      ),
    },
    {
      id: 'new',
      label: 'New Feedback',
      icon: Plus,
      content: (
        <FeedbackForm
          isOpen={true}
          onClose={() => {
            setShowNewFeedbackForm(false);
            if (activeTab === 'new') {
              setActiveTab('messages');
            }
          }}
          onSuccess={handleNewFeedbackSuccess}
          embedded={true}
        />
      ),
    },
  ];

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
                onClick={() => {
                  setShowNewFeedbackForm(true);
                  setActiveTab('new');
                }}
                variant="success"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Feedback
              </Button>
            </div>
          </FormPageFooter>
        )}
      </FormPage>
    </>
  );
}

