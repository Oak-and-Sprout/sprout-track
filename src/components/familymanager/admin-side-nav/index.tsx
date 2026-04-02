'use client';

import React, { useEffect } from 'react';
import { X, Users, Mail, UserCircle, MessageSquare, Plus, Settings, LogOut } from 'lucide-react';
import { LanguageSelector } from '@/src/components/ui/side-nav/language-selector';
import ThemeToggle from '@/src/components/ui/theme-toggle';
import NavCountBubble from '@/src/components/ui/nav-count-bubble';
import { SideNavItem } from '@/src/components/ui/side-nav';
import Image from 'next/image';
import { useDeployment } from '@/app/context/deployment';
import { useLocalization } from '@/src/context/localization';
import { cn } from '@/src/lib/utils';
import { adminSideNavStyles } from './admin-side-nav.styles';
import { AdminSideNavProps } from './admin-side-nav.types';
import './admin-side-nav.css';

const FooterButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  ariaLabel?: string;
}> = ({ icon, label, onClick, ariaLabel }) => (
  <button
    className={cn(adminSideNavStyles.footerButton, "admin-side-nav-footer-button")}
    onClick={onClick}
    aria-label={ariaLabel}
  >
    <span className={adminSideNavStyles.footerButtonIcon}>{icon}</span>
    <span className={adminSideNavStyles.footerButtonLabel}>{label}</span>
  </button>
);

export const AdminSideNav: React.FC<AdminSideNavProps> = ({
  isOpen,
  onClose,
  currentPath,
  onNavigate,
  onLogout,
  onAddFamily,
  onSettingsClick,
  nonModal = false,
  className,
  counts,
}) => {
  const { isSaasMode } = useDeployment();
  const { t } = useLocalization();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !nonModal) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    if (isOpen && !nonModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, nonModal]);

  return (
    <>
      {!nonModal && (
        <div
          className={cn(
            adminSideNavStyles.overlay,
            isOpen ? adminSideNavStyles.overlayOpen : adminSideNavStyles.overlayClosed
          )}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          nonModal ? adminSideNavStyles.containerNonModal : adminSideNavStyles.container,
          !nonModal && (isOpen ? adminSideNavStyles.containerOpen : adminSideNavStyles.containerClosed),
          className,
          "admin-side-nav"
        )}
        role={nonModal ? "navigation" : "dialog"}
        aria-modal={nonModal ? "false" : "true"}
        aria-label="Admin navigation"
      >
        {/* Header */}
        <header className="w-full bg-white sticky top-0 z-40 admin-side-nav-header">
          <div className="mx-auto">
            <div className={cn("flex justify-between items-center min-h-20", adminSideNavStyles.header)}>
              <div className="flex items-center gap-3 flex-1">
                <Image
                  src="/sprout-128.png"
                  alt="Sprout Logo"
                  width={40}
                  height={40}
                  className={adminSideNavStyles.logo}
                  priority
                />
                <div className="flex flex-col justify-center flex-1">
                  <span className={cn(adminSideNavStyles.appName, "admin-side-nav-app-name")}>
                    {t('Family Management')}
                  </span>
                </div>
              </div>

              {!nonModal && (
                <button
                  onClick={onClose}
                  className={cn(adminSideNavStyles.closeButton, "admin-side-nav-close-button")}
                  aria-label="Close navigation"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Navigation Items */}
        <nav className={adminSideNavStyles.navItems}>
          <SideNavItem
            path="/family-manager/families"
            label={t('Families')}
            icon={<Users size={18} />}
            isActive={currentPath === '/family-manager/families'}
            onClick={onNavigate}
            className="admin-side-nav-item"
            badge={<NavCountBubble count={counts.families} />}
          />
          <SideNavItem
            path="/family-manager/invites"
            label={t('Active Invites')}
            icon={<Mail size={18} />}
            isActive={currentPath === '/family-manager/invites'}
            onClick={onNavigate}
            className="admin-side-nav-item"
            badge={<NavCountBubble count={counts.invites} />}
          />
          {isSaasMode && counts.accounts !== undefined && (
            <SideNavItem
              path="/family-manager/accounts"
              label={t('Accounts')}
              icon={<UserCircle size={18} />}
              isActive={currentPath === '/family-manager/accounts'}
              onClick={onNavigate}
              className="admin-side-nav-item"
              badge={<NavCountBubble count={counts.accounts} />}
            />
          )}
          {isSaasMode && counts.feedback !== undefined && (
            <SideNavItem
              path="/family-manager/feedback"
              label={t('Feedback')}
              icon={<MessageSquare size={18} />}
              isActive={currentPath === '/family-manager/feedback'}
              onClick={onNavigate}
              className="admin-side-nav-item"
              badge={
                <NavCountBubble
                  count={counts.feedback}
                  variant={counts.feedback > 0 ? 'accent' : 'default'}
                />
              }
            />
          )}
        </nav>

        {/* Version & Language */}
        <div className="w-full text-center mb-4">
          <div className="flex items-center justify-center gap-2">
            <LanguageSelector />
          </div>
        </div>

        {/* Footer */}
        <div className={cn(adminSideNavStyles.footer, "admin-side-nav-footer")}>
          <FooterButton
            icon={<Plus />}
            label={t('Add New Family')}
            onClick={onAddFamily}
          />
          <ThemeToggle className="mb-2" />
          <FooterButton
            icon={<Settings />}
            label={t('Settings')}
            onClick={onSettingsClick}
          />
          <FooterButton
            icon={<LogOut />}
            label={t('Logout')}
            onClick={onLogout}
          />
        </div>
      </div>
    </>
  );
};

export default AdminSideNav;
