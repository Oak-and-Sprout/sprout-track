'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { 
  FormPage, 
  FormPageContent, 
  FormPageFooter 
} from '@/src/components/ui/form-page';
import { useTheme } from '@/src/context/theme';import { useLocalization } from '@/src/context/localization';

import './feedback-form.css';

interface FeedbackFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  embedded?: boolean; // If true, renders without FormPage wrapper
}

export default function FeedbackForm({
  isOpen,
  onClose,
  onSuccess,
  embedded = false,
}: FeedbackFormProps) {
  const { t } = useLocalization();
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitterInfo, setSubmitterInfo] = useState({
    name: '',
    email: '',
  });
  const [family, setFamily] = useState<{ id: string; name: string } | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Get submitter information from authentication context
  useEffect(() => {
    const getSubmitterInfo = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) return;

        // Parse JWT token to get user info
        const payload = authToken.split('.')[1];
        const decodedPayload = JSON.parse(atob(payload));
        
        // Check if this is account authentication
        if (decodedPayload.isAccountAuth) {
          // For account users, we can get email from the token
          setSubmitterInfo({
            name: decodedPayload.accountEmail ? decodedPayload.accountEmail.split('@')[0] : 'Account User',
            email: decodedPayload.accountEmail || '',
          });
        } else {
          // For caretaker users, get name from token
          setSubmitterInfo({
            name: decodedPayload.name || 'User',
            email: '', // Caretakers don't have email in the token
          });
        }

        // Try to get family information if available
        if (decodedPayload.familyId && decodedPayload.familySlug) {
          // We have family info in the token, try to get family name
          try {
            const familyResponse = await fetch(`/api/family/by-slug/${decodedPayload.familySlug}`, {
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            });
            
            if (familyResponse.ok) {
              const familyData = await familyResponse.json();
              if (familyData.success && familyData.data) {
                setFamily({
                  id: familyData.data.id,
                  name: familyData.data.name
                });
              }
            }
          } catch (familyError) {
            console.log('Could not fetch family info:', familyError);
            // Not a critical error, continue without family info
          }
        }
      } catch (error) {
        console.error('Error parsing auth token:', error);
        setSubmitterInfo({
          name: 'User',
          email: '',
        });
      }
    };

    if (isOpen) {
      getSubmitterInfo();
    }
  }, [isOpen]);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setFormData({
        subject: '',
        message: '',
      });
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.subject.trim() || !formData.message.trim()) {
      alert('Please fill in both subject and message fields.');
      return;
    }
    
    setLoading(true);
    
    try {
      const authToken = localStorage.getItem('authToken');
      
      const payload = {
        subject: formData.subject.trim(),
        message: formData.message.trim(),
        familyId: family?.id || null,
        submitterName: submitterInfo.name,
        submitterEmail: submitterInfo.email || null,
      };
      
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Show success toast
        setShowSuccessToast(true);
        
        // Auto-close after 3 seconds
        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess();
        }, 3000);
      } else {
        console.error('Error submitting feedback:', data.error);
        alert(`Error: ${data.error || 'Failed to submit feedback'}`);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <>
      {/* Success Toast */}
      {showSuccessToast && (
        <div className="mb-4 p-4 rounded-lg feedback-success-toast">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 feedback-success-toast-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium feedback-success-toast-title">
                {t('Thank you for your feedback!')}
              </p>
              <p className="text-sm mt-1 feedback-success-toast-message">
                {t('We appreciate your input and will review your message.')}
                {submitterInfo.email && ' A confirmation email has been sent to you.'}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Submitter Info Display */}
          <div className="feedback-form-info">
            <div className="text-sm text-gray-600 feedback-form-submitter-info">
              <p><strong>{t('From:')}</strong> {submitterInfo.name}</p>
              {submitterInfo.email && (
                <p><strong>{t('Email:')}</strong> {submitterInfo.email}</p>
              )}
              {family && (
                <p><strong>{t('Family:')}</strong> {family.name}</p>
              )}
            </div>
          </div>
          
          {/* Subject */}
          <div className="space-y-2">
            <label htmlFor="subject" className="form-label">
              {t('Subject')} <span className="text-red-500">*</span>
            </label>
            <Input
              id="subject"
              name="subject"
              type="text"
              placeholder="Brief description of your feedback"
              value={formData.subject}
              onChange={handleInputChange}
              required
              disabled={loading}
              className="feedback-form-input"
            />
          </div>
          
          {/* Message */}
          <div className="space-y-2">
            <label htmlFor="message" className="form-label">
              {t('Message')} <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="message"
              name="message"
              placeholder="Please share your detailed feedback, suggestions, or report any issues you've encountered..."
              value={formData.message}
              onChange={handleInputChange}
              required
              disabled={loading}
              rows={6}
              className="feedback-form-textarea"
            />
          </div>
          
          {/* Help Text */}
          <div className="feedback-form-help-text">
            <p className="text-sm text-gray-500">
              {t('Your feedback helps us improve the app. Please be as specific as possible about any issues or suggestions you have.')}
            </p>
          </div>
        </div>
      </form>
    </>
  );

  const formFooter = (
    <div className="flex justify-end space-x-2">
      <Button
        type="button"
        variant="outline"
        onClick={onClose}
        disabled={loading}
      >
        {t('Cancel')}
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={loading || !formData.subject.trim() || !formData.message.trim()}
        variant="success"
      >
        {loading ? 'Sending...' : 'Send Feedback'}
      </Button>
    </div>
  );

  if (embedded) {
    return (
      <>
        <FormPageContent>
          {formContent}
        </FormPageContent>
        <FormPageFooter>
          {formFooter}
        </FormPageFooter>
      </>
    );
  }

  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title="Send Feedback"
      description="Help us improve by sharing your thoughts and suggestions"
    >
      <FormPageContent>
        {formContent}
      </FormPageContent>
      
      <FormPageFooter>
        {formFooter}
      </FormPageFooter>
    </FormPage>
  );
}
