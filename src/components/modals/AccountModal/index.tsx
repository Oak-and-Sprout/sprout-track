import { useState, useEffect, useRef } from 'react';
import PrivacyPolicyModal from '@/src/components/modals/privacy-policy';
import TermsOfUseModal from '@/src/components/modals/terms-of-use';
import { useLocalization } from '@/src/context/localization';
import { StorybookDrawer } from '@/src/components/ui/storybook-drawer';
import { CheckCircle } from 'lucide-react';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'verify' | 'reset-password';
  verificationToken?: string;
  resetToken?: string;
}

export default function AccountModal({
  open,
  onClose,
  initialMode = 'register',
  verificationToken,
  resetToken,
}: AccountModalProps) {
  const { t } = useLocalization();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot-password' | 'verify' | 'reset-password'>(initialMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });

  // Password validation state for real-time feedback
  const [passwordValidation, setPasswordValidation] = useState({
    length: false,
    lowercase: false,
    uppercase: false,
    number: false,
    special: false,
  });

  // Verification state
  const [verificationState, setVerificationState] = useState<'loading' | 'success' | 'error' | 'already-verified'>('loading');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationCountdown, setVerificationCountdown] = useState(3);

  // Password reset state
  const [resetState, setResetState] = useState<'loading' | 'valid' | 'invalid' | 'success' | 'error'>('loading');
  const [resetMessage, setResetMessage] = useState('');
  const [resetCountdown, setResetCountdown] = useState(5);
  const [userEmail, setUserEmail] = useState('');

  // Privacy Policy and Terms of Use modal state
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTermsOfUse, setShowTermsOfUse] = useState(false);

  // Refs for focus management
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const newPasswordInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens/closes or mode changes
  useEffect(() => {
    if (open) {
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
      });
      setPasswordValidation({
        length: false,
        lowercase: false,
        uppercase: false,
        number: false,
        special: false,
      });
      setError('');
      setShowSuccess(false);
      setMode(initialMode);
    }
  }, [open, initialMode]);

  // Email validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Password validation - 8+ chars, lowercase, uppercase, numbers, special characters
  const validatePassword = (password: string): { isValid: boolean; message?: string } => {
    if (password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters long' };
    }
    
    if (!/[a-z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }
    
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }
    
    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one number' };
    }
    
    // SQL-safe special characters
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)' };
    }
    
    return { isValid: true };
  };

  // Real-time password validation for visual feedback
  const updatePasswordValidation = (password: string) => {
    setPasswordValidation({
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate email
    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (mode === 'forgot-password') {
      // For forgot password, we only need email
      await handleForgotPassword();
      return;
    }

    // Validate password for login and register modes
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.message || 'Invalid password');
      return;
    }

    if (mode === 'register') {
      // Validate required fields for registration
      if (!formData.firstName.trim()) {
        setError('First name is required');
        return;
      }

      await handleRegister();
    } else {
      await handleLogin();
    }
  };

  const handleRegister = async () => {
    try {
      setIsSubmitting(true);
      setError('');

      const response = await fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Show success message
      setShowSuccess(true);
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
      });
      setPasswordValidation({
        length: false,
        lowercase: false,
        uppercase: false,
        number: false,
        special: false,
      });

      // Auto-close after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 3000);

    } catch (error) {
      console.error('Registration error:', error);
      setError(error instanceof Error ? error.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async () => {
    try {
      setIsSubmitting(true);
      setError('');

      const response = await fetch('/api/accounts/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Store the token in localStorage
        localStorage.setItem('authToken', result.data.token);
        
        // Set unlock time for session management (account holders are considered "unlocked")
        localStorage.setItem('unlockTime', Date.now().toString());
        
        // Store user info for the AccountButton
        localStorage.setItem('accountUser', JSON.stringify({
          firstName: result.data.user.firstName,
          email: result.data.user.email,
          familySlug: result.data.user.familySlug || null,
        }));

        // Get the AUTH_LIFE and IDLE_TIME values for client-side timeout checks
        // (mirrors AccountLogin.tsx; without these the app falls back to a
        // 30-minute idle window — issue #209)
        try {
          const authLifeResponse = await fetch('/api/settings/auth-life');
          const authLifeData = await authLifeResponse.json();
          if (authLifeData.success) {
            localStorage.setItem('authLifeSeconds', authLifeData.data.toString());
          }

          const idleTimeResponse = await fetch('/api/settings/idle-time');
          const idleTimeData = await idleTimeResponse.json();
          if (idleTimeData.success) {
            localStorage.setItem('idleTimeSeconds', idleTimeData.data.toString());
          }
        } catch (settingsError) {
          console.error('Error fetching session timeout settings:', settingsError);
        }

        // Clear form
        setFormData({
          email: '',
          password: '',
          confirmPassword: '',
          firstName: '',
          lastName: '',
        });
        setPasswordValidation({
          length: false,
          lowercase: false,
          uppercase: false,
          number: false,
          special: false,
        });
        
        // Close modal immediately and refresh page to show logged-in state
        onClose();
        
        // Refresh the page so the AccountButton updates to show logged-in state
        window.location.reload();
        
      } else {
        setError(result.error || 'Login failed. Please try again.');
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

      if (!formData.email.trim()) {
        setError('Please enter your email address');
        return;
      }

      if (!validateEmail(formData.email)) {
        setError('Please enter a valid email address');
        return;
      }

      const response = await fetch('/api/accounts/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim(),
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Show success message
        setShowSuccess(true);
        setFormData({
          email: '',
          password: '',
          confirmPassword: '',
          firstName: '',
          lastName: '',
        });
        setPasswordValidation({
          length: false,
          lowercase: false,
          uppercase: false,
          number: false,
          special: false,
        });

        // Auto-close after 3 seconds
        setTimeout(() => {
          setShowSuccess(false);
          onClose();
        }, 3000);
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

  const toggleMode = () => {
    if (mode === 'login') {
      setMode('register');
    } else if (mode === 'register') {
      setMode('login');
    } else if (mode === 'forgot-password') {
      setMode('login');
    }
    setError('');
    setShowSuccess(false);
  };

  const showForgotPassword = () => {
    setMode('forgot-password');
    setError('');
    setShowSuccess(false);
  };

  // Handle email verification
  const handleVerification = async (token: string) => {
    if (!token) {
      setVerificationState('error');
      setVerificationMessage('Verification token is missing from the URL.');
      return;
    }

    try {
      setVerificationState('loading');
      const response = await fetch('/api/accounts/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setVerificationState('success');
        setVerificationMessage(data.data.message || 'Account verified successfully!');
        
        // Start countdown to login
        setVerificationCountdown(3);
        const timer = setInterval(() => {
          setVerificationCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              // Transition to login mode
              setMode('login');
              setVerificationState('loading');
              setError('');
              setShowSuccess(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setVerificationState('error');
        setVerificationMessage(data.error || 'Verification failed');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setVerificationState('error');
      setVerificationMessage('Network error. Please check your connection and try again.');
    }
  };

  // Handle password reset token validation
  const handlePasswordReset = async (token: string) => {
    if (!token) {
      setResetState('invalid');
      setResetMessage('Reset token is missing from the URL.');
      return;
    }

    try {
      setResetState('loading');
      const response = await fetch(`/api/accounts/reset-password?token=${encodeURIComponent(token)}`);
      const data = await response.json();

      if (response.ok && data.success) {
        if (data.data.valid) {
          setResetState('valid');
          setUserEmail(data.data.email || '');
        } else {
          setResetState('invalid');
          setResetMessage('Invalid or expired reset token.');
        }
      } else {
        setResetState('invalid');
        setResetMessage(data.error || 'Token validation failed');
      }
    } catch (err) {
      console.error('Token validation error:', err);
      setResetState('error');
      setResetMessage('Network error. Please check your connection and try again.');
    }
  };

  // Handle password reset submission
  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate passwords
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.message || 'Invalid password');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const response = await fetch('/api/accounts/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: resetToken,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResetState('success');
        setResetMessage(data.data.message || 'Password has been reset successfully!');
        
        // Start countdown to login
        setResetCountdown(5);
        const timer = setInterval(() => {
          setResetCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              // Transition to login mode
              setMode('login');
              setResetState('loading');
              setError('');
              setShowSuccess(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setResetState('error');
        setResetMessage(data.error || 'Password reset failed');
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setResetState('error');
      setResetMessage('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle verification when modal opens with verify mode
  useEffect(() => {
    if (mode === 'verify' && verificationToken && open) {
      handleVerification(verificationToken);
    }
  }, [mode, verificationToken, open]);

  // Handle password reset when modal opens with reset-password mode
  useEffect(() => {
    if (mode === 'reset-password' && resetToken && open) {
      handlePasswordReset(resetToken);
    }
  }, [mode, resetToken, open]);

  // Focus management - focus the first input field when modal opens or mode changes
  useEffect(() => {
    if (open && !showSuccess && !isSubmitting) {
      // Small delay to ensure the DOM is ready
      const timer = setTimeout(() => {
        if (mode === 'register') {
          // For register mode, focus on email field
          emailInputRef.current?.focus();
        } else if (mode === 'login') {
          // For login mode, focus on email field
          emailInputRef.current?.focus();
        } else if (mode === 'forgot-password') {
          // For forgot password mode, focus on email field
          emailInputRef.current?.focus();
        } else if (mode === 'reset-password' && resetState === 'valid') {
          // For password reset mode, focus on new password field
          newPasswordInputRef.current?.focus();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [open, mode, showSuccess, isSubmitting, resetState]);

  const headings: Record<typeof mode, { title: string; sub?: string }> = {
    login: { title: t('Welcome back.'), sub: t("Sign in to your family's page.") },
    register: { title: t('Create your account.'), sub: t('14 days free, no card needed.') },
    'forgot-password': {
      title: t('Reset your password.'),
      sub: t("We'll email you a link. It works for 15 minutes."),
    },
    verify: { title: t('Verify your email.') },
    'reset-password': { title: t('Set a new password.') },
  };

  return (
    <>
      <StorybookDrawer
        open={open}
        onClose={onClose}
        title={headings[mode].title}
        subtitle={headings[mode].sub}
        art={mode === 'register' ? 'star' : undefined}
        className="sb-auth"
      >
        {showSuccess ? (
          <div className="sb-success">
            <CheckCircle size={34} strokeWidth={1.8} />
            <b>
              {mode === 'forgot-password'
                ? t('Check your email.')
                : t('Check your inbox.')}
            </b>
            <p>
              {mode === 'forgot-password'
                ? t("If that address has an account, a reset link is on its way. It works for 15 minutes.")
                : t('We sent a verification link to your email. Click it to finish setting up.')}
            </p>
          </div>
        ) : mode === 'verify' ? (
          /* ── verify: keep the existing three sub-states, restyled ── */
          verificationState === 'loading' ? (
            <p className="sb-subtitle">{t('Verifying your email…')}</p>
          ) : verificationState === 'success' || verificationState === 'already-verified' ? (
            <div className="sb-success">
              <CheckCircle size={34} strokeWidth={1.8} />
              <b>{t('Email verified.')}</b>
              <p>{verificationMessage}</p>
              <p className="sb-fh">
                {t('Taking you to sign in in {seconds}s…').replace(
                  '{seconds}',
                  String(verificationCountdown)
                )}
              </p>
              <button
                type="button"
                className="sb-btn sb-wide"
                onClick={() => setMode('login')}
              >
                {t('Continue to sign in')}
              </button>
            </div>
          ) : (
            <div className="sb-f-grid">
              <p className="sb-form-error">{verificationMessage}</p>
              <button
                type="button"
                className="sb-btn sb-wide"
                onClick={() => verificationToken && handleVerification(verificationToken)}
              >
                {t('Try again')}
              </button>
              <div className="sb-auth-alt">
                {t('Need a fresh start?')}{' '}
                <button type="button" onClick={() => setMode('register')}>
                  {t('Create a new account')}
                </button>
              </div>
            </div>
          )
        ) : mode === 'reset-password' ? (
          /* ── reset-password: keep the existing sub-states, restyled ── */
          resetState === 'loading' ? (
            <p className="sb-subtitle">{t('Checking your link…')}</p>
          ) : resetState === 'valid' ? (
            <form onSubmit={handlePasswordResetSubmit} className="sb-f-grid">
              {userEmail && <p className="sb-fh">{userEmail}</p>}
              <div>
                <label className="sb-fl" htmlFor="sbNewPassword">{t('New password')}</label>
                <input
                  id="sbNewPassword"
                  ref={newPasswordInputRef}
                  className="sb-fi"
                  type="password"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    updatePasswordValidation(e.target.value);
                  }}
                  required
                  disabled={isSubmitting}
                />
                <PasswordChecklist validation={passwordValidation} t={t} />
              </div>
              <div>
                <label className="sb-fl" htmlFor="sbConfirmPassword">{t('Confirm password')}</label>
                <input
                  id="sbConfirmPassword"
                  className="sb-fi"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  required
                  disabled={isSubmitting}
                />
              </div>
              {error && <p className="sb-form-error">{error}</p>}
              <button type="submit" className="sb-btn sb-wide" disabled={isSubmitting}>
                {isSubmitting ? t('Saving…') : t('Save my new password')}
              </button>
            </form>
          ) : resetState === 'success' ? (
            <div className="sb-success">
              <CheckCircle size={34} strokeWidth={1.8} />
              <b>{t('Password updated.')}</b>
              <p>{resetMessage}</p>
              <p className="sb-fh">
                {t('Taking you to sign in in {seconds}s…').replace(
                  '{seconds}',
                  String(resetCountdown)
                )}
              </p>
            </div>
          ) : (
            <div className="sb-f-grid">
              <p className="sb-form-error">{resetMessage}</p>
              <div className="sb-auth-alt">
                {t('Link expired?')}{' '}
                <button type="button" onClick={showForgotPassword}>
                  {t('Request a new one')}
                </button>
              </div>
            </div>
          )
        ) : (
          /* ── login / register / forgot-password form ── */
          <form onSubmit={handleSubmit} className="sb-f-grid">
            {mode === 'register' && (
              <div className="sb-f2">
                <div>
                  <label className="sb-fl" htmlFor="sbFirstName">{t('First name')}</label>
                  <input
                    id="sbFirstName"
                    ref={firstNameInputRef}
                    className="sb-fi"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="sb-fl" htmlFor="sbLastName">{t('Last name')}</label>
                  <input
                    id="sbLastName"
                    className="sb-fi"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            )}
            <div>
              <label className="sb-fl" htmlFor="sbEmail">{t('Email')}</label>
              <input
                id="sbEmail"
                ref={emailInputRef}
                className="sb-fi"
                type="email"
                placeholder={t('you@example.com')}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isSubmitting}
              />
            </div>
            {mode !== 'forgot-password' && (
              <div>
                <label className="sb-fl" htmlFor="sbPassword">{t('Password')}</label>
                <input
                  id="sbPassword"
                  ref={passwordInputRef}
                  className="sb-fi"
                  type="password"
                  placeholder={mode === 'register' ? t('Make it a good one') : t('Your password')}
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    if (mode === 'register') updatePasswordValidation(e.target.value);
                  }}
                  required
                  disabled={isSubmitting}
                />
                {mode === 'register' && (
                  <PasswordChecklist validation={passwordValidation} t={t} />
                )}
              </div>
            )}
            {error && <p className="sb-form-error">{error}</p>}
            <button type="submit" className="sb-btn sb-wide" disabled={isSubmitting}>
              {isSubmitting
                ? t('One moment…')
                : mode === 'login'
                ? t('Sign me in')
                : mode === 'register'
                ? t('Start my free trial')
                : t('Email me the link')}
            </button>
            {mode === 'register' && (
              <p className="sb-legal">
                {t('By signing up you agree to our')}{' '}
                <button type="button" disabled={isSubmitting} onClick={() => setShowTermsOfUse(true)}>{t('Terms')}</button>
                {' '}{t('and')}{' '}
                <button type="button" disabled={isSubmitting} onClick={() => setShowPrivacyPolicy(true)}>{t('Privacy Policy')}</button>.
              </p>
            )}
            <div className="sb-auth-alt">
              {mode === 'login' && (
                <>
                  {t('New here?')}{' '}
                  <button type="button" onClick={toggleMode} disabled={isSubmitting}>{t('Start your free trial')}</button>
                  <br />
                  {t('Forgot your password?')}{' '}
                  <button type="button" onClick={showForgotPassword} disabled={isSubmitting}>{t('Reset it')}</button>
                </>
              )}
              {mode === 'register' && (
                <>
                  {t('Already have an account?')}{' '}
                  <button type="button" onClick={toggleMode} disabled={isSubmitting}>{t('Sign in')}</button>
                </>
              )}
              {mode === 'forgot-password' && (
                <>
                  {t('Remembered it?')}{' '}
                  <button type="button" onClick={toggleMode} disabled={isSubmitting}>{t('Back to sign in')}</button>
                </>
              )}
            </div>
          </form>
        )}
      </StorybookDrawer>
      <PrivacyPolicyModal open={showPrivacyPolicy} onClose={() => setShowPrivacyPolicy(false)} />
      <TermsOfUseModal open={showTermsOfUse} onClose={() => setShowTermsOfUse(false)} />
    </>
  );
}

function PasswordChecklist({
  validation,
  t,
}: {
  validation: { length: boolean; lowercase: boolean; uppercase: boolean; number: boolean; special: boolean };
  t: (key: string) => string;
}) {
  const rules: Array<[keyof typeof validation, string]> = [
    ['length', '8+ characters'],
    ['number', 'A number'],
    ['lowercase', 'A lowercase letter'],
    ['special', 'A symbol'],
    ['uppercase', 'An uppercase letter'],
  ];
  return (
    <div className="sb-reqs">
      {rules.map(([key, label]) => (
        <span key={key} className={validation[key] ? 'sb-ok' : undefined}>
          <i aria-hidden="true">✓</i>
          {t(label)}
        </span>
      ))}
    </div>
  );
}
