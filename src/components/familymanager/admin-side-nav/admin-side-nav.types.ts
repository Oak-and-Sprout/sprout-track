export interface AdminSideNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onAddFamily: () => void;
  onImportFamily?: () => void;
  onSettingsClick: () => void;
  nonModal?: boolean;
  className?: string;
  counts: {
    families: number;
    invites: number;
    accounts?: number;
    feedback?: number;
    giftCodes?: number;
    shortLinks?: number;
    pageviews?: number;
  };
}
