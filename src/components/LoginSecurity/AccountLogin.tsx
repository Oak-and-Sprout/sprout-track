'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import '../modals/AccountModal/account-modal.css';

interface AccountLoginProps {
  lockoutTime: number | null;
  onLockoutChange: (time: number | null) => void;
}

type LoginMode = 'login' | 'forgot-password';

export default function AccountLogin({ lockoutTime, onLockoutChange }: AccountLoginProps) {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate email
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (mode === 'forgot-password') {
      // For forgot password, we only need email
      await handleForgotPassword();
      return;
    }

    // Validate password for login mode
    if (!password) {
      setError('Password is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const response = await fetch('/api/accounts/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Store the token in localStorage
        localStorage.setItem('authToken', result.data.token);

        // Set unlock time for session management (account holders are considered "unlocked")
        localStorage.setItem('unlockTime', Date.now().toString());

        // Store user info
        localStorage.setItem('accountUser', JSON.stringify({
          firstName: result.data.user.firstName,
          email: result.data.user.email,
          familySlug: result.data.user.familySlug || null,
        }));

        // Get the AUTH_LIFE and IDLE_TIME values for client-side timeout checks
        const authLifeResponse = await fetch('/api/settings/auth-life');
        const authLifeData = await authLifeResponse.json();
        if (authLifeData.success) {
          localStorage.setItem('authLifeSeconds', authLifeData.data.toString());
        }

        // Get the IDLE_TIME value
        const idleTimeResponse = await fetch('/api/settings/idle-time');
        const idleTimeData = await idleTimeResponse.json();
        if (idleTimeData.success) {
          localStorage.setItem('idleTimeSeconds', idleTimeData.data.toString());
        }

        // Clear form
        setEmail('');
        setPassword('');

        // Redirect to the family URL if they have one
        if (result.data.user.familySlug) {
          router.push(`/${result.data.user.familySlug}`);
        } else {
          // If no family, redirect to setup or account page
          router.push('/setup');
        }
      } else {
        setError(result.error || 'Login failed. Please try again.');

        // Check if we're now locked out
        const lockoutCheckResponse = await fetch('/api/auth/ip-lockout');
        const lockoutCheckData = await lockoutCheckResponse.json();

        if (lockoutCheckData.success && lockoutCheckData.data && lockoutCheckData.data.locked) {
          const remainingTime = lockoutCheckData.data.remainingTime || 300000;
          const remainingMinutes = Math.ceil(remainingTime / 60000);
          onLockoutChange(Date.now() + remainingTime);
          setError(`Too many failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    try {
      setIsSubmitting(true);
      setError('');

      if (!email.trim()) {
        setError('Please enter your email address');
        return;
      }

      if (!validateEmail(email)) {
        setError('Please enter a valid email address');
        return;
      }

      const response = await fetch('/api/accounts/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Show success message
        setShowSuccess(true);
        setEmail('');
        setPassword('');

        // Auto-switch back to login after 5 seconds
        setTimeout(() => {
          setShowSuccess(false);
          setMode('login');
        }, 5000);
      } else {
        setError(result.error || 'Failed to send reset email. Please try again.');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showForgotPassword = () => {
    setMode('forgot-password');
    setError('');
    setShowSuccess(false);
  };

  const formatTimeRemaining = (lockoutTime: number) => {
    const remaining = Math.ceil((lockoutTime - Date.now()) / 1000);
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full space-y-4">
      {showSuccess ? (
        <div className="w-full max-w-[320px] mx-auto">
          <div className="account-modal-success">
            <div className="account-modal-success-icon">✓</div>
            <h3 className="account-modal-success-title">Email Sent!</h3>
            <p className="account-modal-success-message">
              If an account with that email exists, we've sent password reset instructions. Check your email and follow the link to reset your password.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="text-center">
            <p className="text-sm text-gray-500 login-description account-modal-description">
              {mode === 'login'
                ? 'Sign in to your account to access your family dashboard'
                : 'Enter your email to receive a password reset link'
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full max-w-[320px] mx-auto space-y-4">
            {/* Email */}
            <div>
              <label className="account-modal-label">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="Enter your email"
                className="w-full"
                required
                disabled={isSubmitting || !!lockoutTime}
                autoFocus
              />
            </div>

            {/* Password - Not shown in forgot password mode */}
            {mode !== 'forgot-password' && (
              <div>
                <label className="account-modal-label">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter your password"
                  className="w-full"
                  required
                  disabled={isSubmitting || !!lockoutTime}
                />
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="account-modal-error text-center">
                {error}
                {lockoutTime && ` (${formatTimeRemaining(lockoutTime)})`}
              </div>
            )}

            {/* Submit button */}
            <Button
              type="submit"
              className="account-modal-submit"
              disabled={isSubmitting || !!lockoutTime}
            >
              {isSubmitting
                ? (mode === 'login' ? 'Signing in...' : 'Sending email...')
                : (mode === 'login' ? 'Sign In' : 'Send Reset Email')
              }
            </Button>

            {/* Forgot Password link for login mode */}
            {mode === 'login' && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={showForgotPassword}
                  className="text-sm text-teal-600 hover:text-teal-700 hover:underline transition-colors"
                  disabled={isSubmitting}
                >
                  Forgot your password?
                </button>
              </div>
            )}

            {/* Back to login link for forgot password mode */}
            {mode === 'forgot-password' && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className="text-sm text-teal-600 hover:text-teal-700 hover:underline transition-colors"
                  disabled={isSubmitting}
                >
                  Back to login
                </button>
              </div>
            )}
          </form>
        </>
      )}
    </div>
  );
}
