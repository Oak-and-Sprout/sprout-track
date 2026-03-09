import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import styles from './full-log-timeline.styles';
import { useLocalization } from '@/src/context/localization';

interface FullLogSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

/**
 * FullLogSearchBar Component
 * 
 * Displays a search bar for filtering activities in the full log timeline
 */
const FullLogSearchBar: React.FC<FullLogSearchBarProps> = ({
  searchQuery,
  onSearchChange,
}) => {
  const { t } = useLocalization();
  return (
    <div className={cn("border-t border-gray-200 bg-gray-100 p-3 full-log-timeline-search-bar", styles.search.bar)}>
      <div className={cn("w-full flex items-center bg-white p-1 full-log-timeline-search-container", styles.search.container)}>
        <Search className="h-4 w-4 text-gray-500 mr-2" />
        <input 
          type="text"
          placeholder={t("Search activities...")}

          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn("w-full border-0 bg-transparent focus:ring-0 focus:outline-none h-8 px-0 py-1 text-sm full-log-timeline-search-input", styles.search.input)}
        />
      </div>
    </div>
  );
};

export default FullLogSearchBar;
