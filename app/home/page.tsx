'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { ThemeToggle } from '@/src/components/ui/theme-toggle';
import { AccountButton } from '@/src/components/ui/account-button';
import AccountModal from '@/src/components/modals/AccountModal';
import AccountManager from '@/src/components/account-manager';
import { useTheme } from '@/src/context/theme';
import { Github, Users, TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import PrivacyPolicyModal from '@/src/components/modals/privacy-policy';
import TermsOfUseModal from '@/src/components/modals/terms-of-use';
import './home.css';

const home = () => {
  const { theme } = useTheme();
  const [currentActivity, setCurrentActivity] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentCaretakerVideo, setCurrentCaretakerVideo] = useState(0);
  const [isCaretakerTransitioning, setIsCaretakerTransitioning] = useState(false);
  
  // Account modal state for verification and password reset
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountModalMode, setAccountModalMode] = useState<'login' | 'register' | 'verify' | 'reset-password'>('register');
  const [verificationToken, setVerificationToken] = useState<string | undefined>();
  const [resetToken, setResetToken] = useState<string | undefined>();
  
  // Privacy Policy and Terms of Use modal state
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTermsOfUse, setShowTermsOfUse] = useState(false);
  
  // Account Manager state
  const [showAccountManager, setShowAccountManager] = useState(false);
  
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  
  const activities = ['Sleep', 'Bottles', 'Diapers', 'Baths', 'Milestones', 'Medicine'];

  // Animated tagline effect
  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentActivity((prev) => (prev + 1) % activities.length);
        setIsAnimating(false);
      }, 400); // Half of the transition duration
    }, 2000);
    return () => clearInterval(interval);
  }, [activities.length]);

  // Caretaker video transition effect with different timing for each video and theme
  useEffect(() => {
    const scheduleNextTransition = () => {
      // Different durations for each video and theme (in milliseconds)
      // [light_mode_duration, dark_mode_duration]
      const videoDurations = [
        [15500, 14000], // AddCaretaker: Light 15.5s, Dark 14s
        [7500, 9500]    // Login: Light 7.5s, Dark 9.5s
      ];
      
      const themeIndex = theme === 'dark' ? 1 : 0;
      const currentDuration = videoDurations[currentCaretakerVideo][themeIndex];
      
      const timeout = setTimeout(() => {
        setIsCaretakerTransitioning(true);
        setTimeout(() => {
          setCurrentCaretakerVideo((prev) => (prev + 1) % 2);
          setIsCaretakerTransitioning(false);
        }, 100); // 100ms transition
      }, currentDuration);
      
      return timeout;
    };

    const timeout = scheduleNextTransition();
    return () => clearTimeout(timeout);
  }, [currentCaretakerVideo, theme]);

  // Check for verification, password reset hashes, and upgrade query parameter on load
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#verify?')) {
        const urlParams = new URLSearchParams(hash.substring(8)); // Remove '#verify?'
        const token = urlParams.get('token');
        if (token) {
          setVerificationToken(token);
          setAccountModalMode('verify');
          setShowAccountModal(true);
          // Clear the hash after processing
          window.history.replaceState(null, '', window.location.pathname);
        }
      } else if (hash.startsWith('#passwordreset?')) {
        const urlParams = new URLSearchParams(hash.substring(15)); // Remove '#passwordreset?'
        const token = urlParams.get('token');
        if (token) {
          setResetToken(token);
          setAccountModalMode('reset-password');
          setShowAccountModal(true);
          // Clear the hash after processing
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    };

    const checkQueryParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const upgrade = urlParams.get('upgrade');
      const family = urlParams.get('family');

      if (upgrade === 'true') {
        // Show login modal for account upgrade
        setAccountModalMode('login');
        setShowAccountModal(true);

        // Clear the query parameter after processing
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('upgrade');
        newUrl.searchParams.delete('family');
        window.history.replaceState(null, '', newUrl.toString());
      }
    };

    // Check on mount
    checkHash();
    checkQueryParams();

    // Listen for hash changes
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // Email validation
  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailValue) {
      setEmailError('Email is required');
      return false;
    }
    if (!emailRegex.test(emailValue)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  // Handle form submission
  const handleFormSubmit = async () => {
    if (!validateEmail(email)) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/beta-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email,
          firstName: firstName || undefined,
          lastName: lastName || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign up');
      }
      
      // Success - show success message
      setShowSuccess(true);
      setEmail('');
      setFirstName('');
      setLastName('');
      
      // Hide success message after 10 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 10000);
    } catch (error) {
      console.error('Error submitting signup:', error);
      alert('There was an error signing up. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="saas-homepage">
      {/* Header */}
      <header className="saas-header">
        <nav className="saas-nav">
          <div className="saas-nav-content">
            <div className="saas-logo">
              <img 
                src="/sprout-256.png" 
                alt="Sprout Track Logo" 
                className="saas-logo-image"
              />
              <span className="saas-logo-text">Sprout Track</span>
            </div>
            <div className="flex items-center gap-2">
              <AccountButton 
                label="Sign Up" 
                showIcon={false}
                variant="link"
                initialMode="register"
                onOpenAccountModal={(mode) => {
                  setAccountModalMode(mode);
                  setShowAccountModal(true);
                }}
                hideWhenLoggedIn={true}
              />
              <AccountButton 
                label="Sign In" 
                showIcon={false} 
                initialMode="login"
                onOpenAccountModal={(mode) => {
                  setAccountModalMode(mode);
                  setShowAccountModal(true);
                }}
                className="saas-account-btn"
                onAccountManagerOpen={() => setShowAccountManager(true)}
              />
              <ThemeToggle variant="light" className="saas-theme-toggle" />
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="saas-hero">
        <div className="saas-hero-content">
          <div className="saas-hero-text">
            
            <Badge className="saas-hero-badge">
              🎉 The Sprout Track Beta is Live 🎉
            </Badge>
            <h1 className="saas-hero-title">
              Easily track your baby's{' '}
              <span className={`saas-hero-animated-word ${isAnimating ? 'animating' : ''}`}>
                {activities[currentActivity]}
              </span>
            </h1>
            <p className="saas-hero-description">
              The complete baby tracking solution built by parents for parents. Monitor sleep, feeding, 
              diapers, milestones, and more with our intuitive, family-friendly platform.
            </p>
            <p className="saas-hero-description">
              <b>Simple to use.  Privacy-focused.  Accessible anywhere.</b>
            </p>
            {/* <div className="saas-hero-actions">
              <Button size="lg" className="saas-hero-cta">
                Start Free Trial
              </Button>
              <Button variant="outline" size="lg" className="saas-hero-demo">
                Watch Demo
              </Button>
            </div> */}
          </div>
        </div>
      </section>

      {/* Main Demo Video Section */}
      <section className="saas-main-demo">
        <div className="saas-main-demo-content">
          <div className="saas-main-demo-video">
            <div style={{borderRadius: '5px', backgroundColor: '#0d9488', overflow: 'hidden' }}>
              <video 
                src={theme === 'dark' ? '/DemoMainDark.mp4' : '/DemoMainLight.mp4'}
                autoPlay
                loop
                muted
                playsInline
                style={{ 
                  width: '100%', 
                  height: 'auto',
                  border: 'none'
                }}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      </section>

      {/* Transition Section with Concave Circle */}
      <section className="saas-transition-section">
        <div className="saas-transition-content"></div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="saas-cta">
        <div className="saas-cta-content">
          <h2 className="saas-cta-title">Don't take our word for it - try it yourself!</h2>
          <p className="saas-cta-description">
            Experience Sprout Track with our live demo environment based on realistic data.
          </p>
          <div className="saas-cta-actions">
            <div className="max-w-md mx-auto space-y-4">
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                asChild
              >
                <a href="/demo">
                  Try the Live Demo
                </a>
              </Button>
              <div className="saas-demo-details">
                <p className="saas-demo-details-title">
                  Demo Access Details:
                </p>
                <div className="saas-demo-details-grid">
                  <div>
                    <span className="saas-demo-label">Login ID:</span>
                    <span className="saas-demo-value">01</span>
                  </div>
                  <div>
                    <span className="saas-demo-label">PIN:</span>
                    <span className="saas-demo-value">111111</span>
                  </div>
                </div>
              </div>
              <p className="saas-demo-refresh-note">
                Demo data refreshes automatically every hour
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Sections */}
      {/* Adding Caretakers */}
      <section className="saas-feature-section saas-feature-section-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <h3 className="saas-feature-title">
                Manage Your Care Team
              </h3>
              <p className="saas-feature-description">
                Add multiple caretakers to your family account. Parents, grandparents, babysitters, and daycare providers can all contribute to tracking your baby's activities with secure, individual access.
              </p>
              <ul className="saas-feature-list">
                <li className="saas-feature-list-item">
                  <span className="w-2 h-2 bg-teal-500 rounded-full mr-3"></span>
                  Easy ID and Pin access for each caretaker (no account required)
                </li>
                <li className="saas-feature-list-item">
                  <span className="w-2 h-2 bg-teal-500 rounded-full mr-3"></span>
                  Everything accessible from your unique family web address
                </li>
                <li className="saas-feature-list-item">
                  <span className="w-2 h-2 bg-teal-500 rounded-full mr-3"></span>
                  Real-time sync across all devices
                </li>
              </ul>
            </div>
            <div className="order-1 lg:order-2 relative overflow-visible">
              {/* Background icon - offset to bottom right */}
              <div className="absolute bottom-16 -right-12 z-0">
                <Users size={200} className="text-teal-500 opacity-20" />
              </div>
              {/* Caretaker Demo Videos */}
              <div className="relative z-10 max-w-sm mx-auto">
                <div className="saas-demo-phone-video">
                  <video 
                    key={`${theme}-${currentCaretakerVideo}`}
                    src={
                      theme === 'dark' 
                        ? (currentCaretakerVideo === 0 ? '/AddCaretakerDark.mp4' : '/LoginDark.mp4')
                        : (currentCaretakerVideo === 0 ? '/AddCaretakerLight.mp4' : '/LoginLight.mp4')
                    }
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ 
                      width: '100%', 
                      height: '100%',
                      objectFit: 'cover',
                      opacity: isCaretakerTransitioning ? 0 : 1,
                      transition: 'opacity 400ms ease-in-out'
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Baby Stats */}
      <section className="saas-feature-section saas-feature-section-gray">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative overflow-visible">
              {/* Background icon - offset to bottom left */}
              <div className="absolute bottom-16 -left-12 z-0">
                <TrendingUp size={200} className="text-emerald-500 opacity-20" />
              </div>
              {/* Baby Info Demo Video */}
              <div className="relative z-10 max-w-sm mx-auto">
                <div className="saas-demo-phone-video">
                  <video 
                    src={theme === 'dark' ? '/BabyInfoButtonDark.mp4' : '/BabyInfoButtonLight.mp4'}
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ 
                      width: '100%', 
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            </div>
            <div>
              <h3 className="saas-feature-title">
                Track Important Baby Info
              </h3>
              <p className="saas-feature-description">
                Instantly see your baby's latest events, check family contacts, and view trends for the past month—like average feedings, diapers, wake windows, sleep windows, and more—all in one place.
              </p>
              <ul className="saas-feature-list">
                <li className="saas-feature-list-item">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></span>
                  View the most recent important activities at a glance
                </li>
                <li className="saas-feature-list-item">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></span>
                  Quickly view emergency contacts
                </li>
                <li className="saas-feature-list-item">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></span>
                  Spot trends and changes in your baby's daily routines
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Stats */}
      <section className="saas-feature-section saas-feature-section-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <h3 className="saas-feature-title">
                Daily Activity Overview
              </h3>
              <p className="saas-feature-description">
                Get a complete picture of your baby's day with intuitive daily summaries. See feeding times, diaper changes, sleep periods, and activities at a glance.
              </p>
              <ul className="saas-feature-list">
                <li className="saas-feature-list-item">
                <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></span>
                  Timeline view of daily activities
                </li>
                <li className="saas-feature-list-item">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></span>
                  Quick stats and totals for the day
                </li>
                <li className="saas-feature-list-item">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></span>
                  Filter for specific activities
                </li>
              </ul>
            </div>
            <div className="order-1 lg:order-2 relative overflow-visible">
              {/* Background icon - offset to bottom right */}
              <div className="absolute bottom-16 -right-12 z-0">
                <BarChart3 size={200} className="text-teal-600 opacity-20" />
              </div>
              {/* Daily Stats Demo Video */}
              <div className="relative z-10 max-w-sm mx-auto">
                <div className="saas-demo-phone-video">
                  <video 
                    src={theme === 'dark' ? '/DailyStatsDark.mp4' : '/DailyStatsLight.mp4'}
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ 
                      width: '100%', 
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Calendar */}
      <section className="saas-feature-section saas-feature-section-gray">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative overflow-visible">
              {/* Background icon - offset to bottom left */}
              <div className="absolute bottom-16 -left-12 z-0">
                <Calendar size={200} className="text-teal-600 opacity-20" />
              </div>
              {/* Calendar Demo Video */}
              <div className="relative z-10 max-w-sm mx-auto">
                <div className="saas-demo-phone-video">
                  <video 
                    src={theme === 'dark' ? '/CalendarDark.mp4' : '/CalendarLight.mp4'}
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={{ 
                      width: '100%', 
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            </div>
            <div>
              <h3 className="saas-feature-title">
                Schedule & Plan Ahead
              </h3>
              <p className="saas-feature-description">
                Keep track of appointments, caretaker schedules, and important events with our integrated calendar. Keep everyone in the loop!
              </p>
              <ul className="saas-feature-list">
                <li className="saas-feature-list-item">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></span>
                  Help coordinate schedules between caretakers
                </li>
                <li className="saas-feature-list-item">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></span>
                  Keep track of appoitnments
                </li>
                <li className="saas-feature-list-item">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></span>
                  Add custom events and reminders
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Beta CTA Section */}
      <section id="signup" className="py-16 bg-gradient-to-r from-teal-600 to-emerald-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            The Beta is Live!
          </h2>
          <p className="text-xl text-teal-100 mb-8 max-w-2xl mx-auto">
            Join our beta program and get Sprout Track for free for life for your entire family. 
            Be among the first to experience the future of baby tracking.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="bg-white text-teal-600 hover:bg-gray-100 font-semibold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
              onClick={() => {
                setAccountModalMode('register');
                setShowAccountModal(true);
              }}
            >
              Sign Up for the Beta
            </Button>
          </div>
          <p className="text-sm text-teal-100 mt-6 max-w-lg mx-auto">
            Beta users get lifetime free access for their family. No credit card required. 
            Start tracking your baby's journey today!
          </p>
        </div>
      </section>
      

      {/* Footer */}
      <footer className="saas-footer">
        <div className="saas-footer-content">
          <div className="saas-footer-brand">
            <div className="saas-logo">
              <img 
                src="/sprout-256.png" 
                alt="Sprout Track Logo" 
                className="saas-logo-image"
              />
              <span className="saas-logo-text">Sprout Track</span>
            </div>
            <p className="saas-footer-description">
              Sprouting into something amazing.
            </p>
          </div>
          <div className="saas-footer-demo">
            <Button 
              size="lg" 
              className="mb-4" 
              asChild
            >
              <a href="/demo">
                Try the Demo
              </a>
            </Button>
            <p className="saas-footer-description text-sm mb-4">
              Demo refreshes every 1 hour
            </p>
            <div className="space-y-1">
              <p className="saas-footer-description text-sm">
                <strong>Demo Access:</strong>
              </p>
              <p className="saas-footer-description text-sm">
                Login ID: 01
              </p>
              <p className="saas-footer-description text-sm">
                PIN: 111111
              </p>
            </div>
          </div>
        </div>
      <div className="saas-footer-bottom relative flex flex-col sm:flex-row items-center justify-center gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <p className="saas-footer-copyright">
            © 2025 Oak and Sprout. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={() => setShowPrivacyPolicy(true)}
              className="text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer underline-offset-4 hover:underline"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setShowTermsOfUse(true)}
              className="text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer underline-offset-4 hover:underline"
            >
              Terms of Use
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 saas-footer-copyright">
        <p>Follow on</p>
        <Button variant="outline" size="sm" asChild className="p-2">
            <a 
              href="https://github.com/Oak-and-Sprout/sprout-track" 
              target="_blank" 
              rel="noopener noreferrer"
              className="saas-github-link"
            >
              <Github size={16} />
            </a>
          </Button>
        </div>
          <div style={{ width: '200px' }}>
            <a href="https://www.buymeacoffee.com/joverton" className="group block">
              <img 
                src="https://img.buymeacoffee.com/button-api/?text=Support This Project&emoji=☕&slug=joverton&button_colour=008375&font_colour=ffffff&font_family=Inter&outline_colour=ffffff&coffee_colour=FFDD00" 
                alt="Support This Project" 
                style={{ width: '100%', height: 'auto', transition: 'transform 0.8s ease' }}
                className="group-hover:scale-105"
              />
            </a>
          </div>
      </div>
      </footer>

      {/* Account Modal for verification and other auth flows */}
      <AccountModal 
        open={showAccountModal} 
        onClose={() => setShowAccountModal(false)}
        initialMode={accountModalMode}
        verificationToken={verificationToken}
        resetToken={resetToken}
      />

      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal 
        open={showPrivacyPolicy} 
        onClose={() => setShowPrivacyPolicy(false)} 
      />

      {/* Terms of Use Modal */}
      <TermsOfUseModal 
        open={showTermsOfUse} 
        onClose={() => setShowTermsOfUse(false)} 
      />

      {/* Account Manager - This component is controlled by the page state */}
      <AccountManager
        isOpen={showAccountManager}
        onClose={() => setShowAccountManager(false)}
      />
    </div>
  );
};

export default home;
