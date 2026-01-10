import React, { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import {
  Moon,
  Icon,
  Edit,
  ChevronLeft,
  ChevronRight,
  Bath,
  ChevronDown,
  LampWallDown,
  Trophy,
  Ruler,
  PillBottle,
} from 'lucide-react';
import { diaper, bottleBaby } from '@lucide/lab';
import { FilterType, TimelineFilterProps } from './types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/src/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/src/components/ui/popover';
import { Calendar } from '@/src/components/ui/calendar';
import { useLocalization } from '@/src/context/localization';

const TimelineFilter = ({
  selectedDate,
  activeFilter,
  onDateChange,
  onDateSelection,
  onFilterChange,
}: TimelineFilterProps) => {
  

  const { t } = useLocalization();  

  // State for popover open/close
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Define filter types and their icons
  const filterOptions = [
    { type: 'sleep', icon: <Moon className="h-4 w-4" />, label: 'Sleep' },
    { type: 'feed', icon: <Icon iconNode={bottleBaby} className="h-4 w-4" />, label: 'Feed' },
    { type: 'diaper', icon: <Icon iconNode={diaper} className="h-4 w-4" />, label: 'Diaper' },
    { type: 'bath', icon: <Bath className="h-4 w-4" />, label: 'Bath' },
    { type: 'note', icon: <Edit className="h-4 w-4" />, label: 'Note' },
    { type: 'pump', icon: <LampWallDown className="h-4 w-4" />, label: 'Pump' },
    { type: 'milestone', icon: <Trophy className="h-4 w-4" />, label: 'Milestone' },
    { type: 'measurement', icon: <Ruler className="h-4 w-4" />, label: 'Measurement' },
    { type: 'medicine', icon: <PillBottle className="h-4 w-4" />, label: 'Medicine' },
  ] as const;



  return (
    <div className="flex justify-between px-6 py-3 items-center text-sm font-medium">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDateChange(-1)}
          className="h-7 w-7 text-white hover:bg-transparent hover:text-white/90 p-0 -ml-2"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              className="h-7 px-2 text-sm font-medium text-white hover:bg-transparent hover:text-white/90"
            >
              {selectedDate.toLocaleDateString('en-US', { 
                month: '2-digit', 
                day: '2-digit',
                year: 'numeric'
              })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-auto" align="start">
            <Calendar
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  date.setHours(0, 0, 0, 0);
                  onDateSelection(date);
                  setCalendarOpen(false); // Close the popover after selection
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDateChange(1)}
          className="h-7 w-7 text-white hover:bg-transparent hover:text-white/90 p-0"
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex items-center gap-1 h-7 text-sm font-medium text-white hover:bg-transparent hover:text-white/90 p-0"
          >
            {t('Filters')} <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {filterOptions.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.type}
              checked={activeFilter === option.type}
              onCheckedChange={() => onFilterChange(activeFilter === option.type ? null : option.type as FilterType)}
              className="flex items-center gap-2"
            >
              <span className="flex items-center justify-center w-6">{option.icon}</span>
              <span>{option.label}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};



export default TimelineFilter;
