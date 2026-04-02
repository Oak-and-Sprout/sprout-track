'use client';

import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/src/components/ui/dropdown-menu';
import type { SortDirection } from '@/src/components/ui/table';
import { useLocalization } from '@/src/context/localization';

interface SortOption {
  key: string;
  label: string;
}

interface MobileSortButtonProps {
  options: SortOption[];
  sortColumn: string | null;
  sortDirection: SortDirection;
  onSort: (column: string) => void;
}

export default function MobileSortButton({
  options,
  sortColumn,
  sortDirection,
  onSort,
}: MobileSortButtonProps) {
  const { t } = useLocalization();

  const getSortIcon = (key: string) => {
    if (sortColumn !== key) return null;
    if (sortDirection === 'asc') return <ArrowUp className="h-3 w-3 ml-auto text-teal-600" />;
    if (sortDirection === 'desc') return <ArrowDown className="h-3 w-3 ml-auto text-teal-600" />;
    return null;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 rounded-full p-0 flex-shrink-0 mobile-sort-button"
          title={t('Sort')}
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t('Sort by')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuItem
            key={option.key}
            onClick={() => onSort(option.key)}
            className={`flex items-center justify-between ${sortColumn === option.key ? 'font-medium' : ''}`}
          >
            {t(option.label)}
            {getSortIcon(option.key)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
