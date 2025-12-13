import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Settings } from '@prisma/client';
import { CardHeader } from '@/src/components/ui/card';
import SleepForm from '@/src/components/forms/SleepForm';
import FeedForm from '@/src/components/forms/FeedForm';
import DiaperForm from '@/src/components/forms/DiaperForm';
import NoteForm from '@/src/components/forms/NoteForm';
import BathForm from '@/src/components/forms/BathForm';
import PumpForm from '@/src/components/forms/PumpForm';
import MilestoneForm from '@/src/components/forms/MilestoneForm';
import MeasurementForm from '@/src/components/forms/MeasurementForm';
import GiveMedicineForm from '@/src/components/forms/GiveMedicineForm';
import { ActivityType, FilterType, FullLogTimelineProps } from './full-log-timeline.types';
import FullLogFilter from './FullLogFilter';
import FullLogSearchBar from './FullLogSearchBar';
import FullLogActivityList from './FullLogActivityList';
import FullLogActivityDetails from './FullLogActivityDetails';
import { getActivityEndpoint, getActivityTime } from '@/src/components/Timeline/utils';
import { PumpLogResponse, MedicineLogResponse } from '@/app/api/types';
import { cn } from '@/src/lib/utils';
import styles from './full-log-timeline.styles';
import './full-log-timeline.css';

/**
 * FullLogTimeline Component
 * 
 * A comprehensive timeline view that displays activities over a date range
 * with filtering and pagination capabilities.
 */
const FullLogTimeline: React.FC<FullLogTimelineProps> = ({
  activities,
  onActivityDeleted,
  startDate,
  endDate,
  onDateRangeChange,
}) => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);
  const [editModalType, setEditModalType] = useState<'sleep' | 'feed' | 'diaper' | 'note' | 'bath' | 'pump' | 'milestone' | 'measurement' | 'medicine' | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch settings on component mount
  useEffect(() => {
    const fetchSettings = async () => {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSettings(data.data);
        }
      }
    };
    fetchSettings();
  }, []);

  // Handle quick filter for date ranges
  const handleQuickFilter = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setCurrentPage(1); // Reset to first page
    onDateRangeChange(start, end);
  };

  // Search function to check if activity matches search query
  const matchesSearch = useCallback((activity: ActivityType, query: string): boolean => {
    if (!query) return true;
    
    const searchLower = query.toLowerCase();
    
    // Check common fields
    if (activity.babyId && activity.babyId.toLowerCase().includes(searchLower)) return true;
    if (activity.caretakerName && activity.caretakerName.toLowerCase().includes(searchLower)) return true;
    
    // Type guards for different activity types
    const isSleepActivity = (act: any): act is { 
      duration: number; 
      type?: string; 
      location?: string; 
      quality?: string;
    } => {
      return 'duration' in act;
    };
    
    const isFeedActivity = (act: any): act is { 
      amount: number; 
      type?: string; 
      unitAbbr?: string; 
      side?: string; 
      food?: string;
      notes?: string;
      bottleType?: string;
    } => {
      return 'amount' in act;
    };
    
    const isDiaperActivity = (act: any): act is { 
      condition: string; 
      type?: string; 
      color?: string;
    } => {
      return 'condition' in act;
    };
    
    const isNoteActivity = (act: any): act is { 
      content: string; 
      category?: string;
    } => {
      return 'content' in act;
    };
    
    const isBathActivity = (act: any): act is { 
      soapUsed: boolean; 
      notes?: string;
    } => {
      return 'soapUsed' in act;
    };
    
    const isPumpActivity = (act: any): act is { 
      leftAmount?: number; 
      rightAmount?: number; 
      totalAmount?: number; 
      unit?: string; 
      notes?: string;
    } => {
      return 'leftAmount' in act || 'rightAmount' in act;
    };
    
    const isMilestoneActivity = (act: any): act is { 
      title: string; 
      category: string; 
      description?: string;
    } => {
      return 'title' in act && 'category' in act;
    };
    
    const isMeasurementActivity = (act: any): act is { 
      value: number; 
      unit: string; 
      type?: string; 
      notes?: string;
    } => {
      return 'value' in act && 'unit' in act;
    };
    
    const isMedicineActivity = (act: any): act is {
      doseAmount: number;
      medicineId: string;
      unitAbbr?: string;
      notes?: string;
      medicine?: { name?: string };
    } => {
      return 'doseAmount' in act && 'medicineId' in act;
    };
    
    // Check type-specific fields
    if (isSleepActivity(activity)) {
      if (activity.type && activity.type.toLowerCase().includes(searchLower)) return true;
      if (activity.location && activity.location.toLowerCase().includes(searchLower)) return true;
      if (activity.quality && activity.quality.toLowerCase().includes(searchLower)) return true;
      return false;
    }
    
    if (isFeedActivity(activity)) {
      if (activity.type && activity.type.toLowerCase().includes(searchLower)) return true;
      if (activity.amount && activity.amount.toString().includes(searchLower)) return true;
      if (activity.unitAbbr && activity.unitAbbr.toLowerCase().includes(searchLower)) return true;
      if (activity.side && activity.side.toLowerCase().includes(searchLower)) return true;
      if (activity.food && activity.food.toLowerCase().includes(searchLower)) return true;
      if (activity.notes && activity.notes.toLowerCase().includes(searchLower)) return true;
      if (activity.bottleType && activity.bottleType.toLowerCase().includes(searchLower)) return true;
      return false;
    }
    
    if (isDiaperActivity(activity)) {
      if (activity.type && activity.type.toLowerCase().includes(searchLower)) return true;
      if (activity.condition && activity.condition.toLowerCase().includes(searchLower)) return true;
      if (activity.color && activity.color.toLowerCase().includes(searchLower)) return true;
      return false;
    }
    
    if (isNoteActivity(activity)) {
      if (activity.content && activity.content.toLowerCase().includes(searchLower)) return true;
      if (activity.category && activity.category.toLowerCase().includes(searchLower)) return true;
      return false;
    }
    
    if (isBathActivity(activity)) {
      if (activity.notes && activity.notes.toLowerCase().includes(searchLower)) return true;
      return false;
    }
    
    if (isPumpActivity(activity)) {
      if (activity.leftAmount && activity.leftAmount.toString().includes(searchLower)) return true;
      if (activity.rightAmount && activity.rightAmount.toString().includes(searchLower)) return true;
      if (activity.totalAmount && activity.totalAmount.toString().includes(searchLower)) return true;
      if (activity.unit && activity.unit.toLowerCase().includes(searchLower)) return true;
      if (activity.notes && activity.notes.toLowerCase().includes(searchLower)) return true;
      return false;
    }
    
    if (isMilestoneActivity(activity)) {
      if (activity.title && activity.title.toLowerCase().includes(searchLower)) return true;
      if (activity.category && activity.category.toLowerCase().includes(searchLower)) return true;
      if (activity.description && activity.description.toLowerCase().includes(searchLower)) return true;
      return false;
    }
    
    if (isMeasurementActivity(activity)) {
      if (activity.type && activity.type.toLowerCase().includes(searchLower)) return true;
      if (activity.value && activity.value.toString().includes(searchLower)) return true;
      if (activity.unit && activity.unit.toLowerCase().includes(searchLower)) return true;
      if (activity.notes && activity.notes.toLowerCase().includes(searchLower)) return true;
      return false;
    }
    
    if (isMedicineActivity(activity)) {
      if (activity.doseAmount && activity.doseAmount.toString().includes(searchLower)) return true;
      if (activity.unitAbbr && activity.unitAbbr.toLowerCase().includes(searchLower)) return true;
      if (activity.notes && activity.notes.toLowerCase().includes(searchLower)) return true;
      if (activity.medicine && activity.medicine.name && 
          activity.medicine.name.toLowerCase().includes(searchLower)) return true;
      return false;
    }
    
    return false;
  }, []);

  // Filter and sort activities
  const sortedActivities = useMemo(() => {
    // First filter by activity type
    const typeFiltered = !activeFilter 
      ? activities 
      : activities.filter(activity => {
          switch (activeFilter) {
            case 'sleep':
              return 'duration' in activity;
            case 'feed':
              return 'amount' in activity;
            case 'diaper':
              return 'condition' in activity;
            case 'note':
              return 'content' in activity;
            case 'bath':
              return 'soapUsed' in activity;
            case 'pump':
              return 'leftAmount' in activity || 'rightAmount' in activity;
            case 'milestone':
              return 'title' in activity && 'category' in activity;
            case 'measurement':
              return 'value' in activity && 'unit' in activity;
            case 'medicine':
              return 'doseAmount' in activity && 'medicineId' in activity;
            default:
              return true;
          }
        });
    
    // Then filter by search query
    const searchFiltered = !searchQuery 
      ? typeFiltered 
      : typeFiltered.filter(activity => matchesSearch(activity, searchQuery));

    const sorted = [...searchFiltered].sort((a, b) => {
      const timeA = new Date(getActivityTime(a));
      const timeB = new Date(getActivityTime(b));
      return timeB.getTime() - timeA.getTime();
    });

    const startIndex = (currentPage - 1) * itemsPerPage;
    return sorted.slice(startIndex, startIndex + itemsPerPage);
  }, [activities, activeFilter, currentPage, itemsPerPage, searchQuery, matchesSearch]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    // First filter by activity type
    const typeFiltered = !activeFilter 
      ? activities 
      : activities.filter(activity => {
          switch (activeFilter) {
            case 'sleep':
              return 'duration' in activity;
            case 'feed':
              return 'amount' in activity;
            case 'diaper':
              return 'condition' in activity;
            case 'note':
              return 'content' in activity;
            case 'bath':
              return 'soapUsed' in activity;
            case 'pump':
              return 'leftAmount' in activity || 'rightAmount' in activity;
            case 'milestone':
              return 'title' in activity && 'category' in activity;
            case 'measurement':
              return 'value' in activity && 'unit' in activity;
            case 'medicine':
              return 'doseAmount' in activity && 'medicineId' in activity;
            default:
              return true;
          }
        });
    
    // Then filter by search query
    const searchFiltered = !searchQuery 
      ? typeFiltered 
      : typeFiltered.filter(activity => matchesSearch(activity, searchQuery));
    
    return Math.ceil(searchFiltered.length / itemsPerPage);
  }, [activities, activeFilter, itemsPerPage, searchQuery, matchesSearch]);

  // Handle activity deletion
  const handleDelete = async (activity: ActivityType) => {
    if (!confirm('Are you sure you want to delete this activity?')) return;

    const endpoint = getActivityEndpoint(activity);

    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/${endpoint}?id=${activity.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': authToken ? `Bearer ${authToken}` : '',
        },
      });

      if (response.ok) {
        setSelectedActivity(null);
        onActivityDeleted?.();
      }
    } catch (error) {
      console.error('Error deleting activity:', error);
    }
  };

  // Handle activity editing
  const handleEdit = (activity: ActivityType, type: 'sleep' | 'feed' | 'diaper' | 'note' | 'bath' | 'pump' | 'milestone' | 'measurement' | 'medicine') => {
    setSelectedActivity(activity);
    setEditModalType(type);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle items per page change
  const handleItemsPerPageChange = (count: number) => {
    setItemsPerPage(count);
    setCurrentPage(1); // Reset to first page
  };

  return (
    <div className={cn(styles.container, "full-log-timeline-container")}>
      {/* Header */}
      <CardHeader className="py-0 bg-gradient-to-r from-teal-600 to-teal-700 border-0 full-log-timeline-header">
        <FullLogFilter
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          startDate={startDate}
          endDate={endDate}
          onDateRangeChange={onDateRangeChange}
          onQuickFilter={handleQuickFilter}
        />
      </CardHeader>

      {/* Search Bar */}
      <FullLogSearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Activity List */}
      <FullLogActivityList
        activities={sortedActivities}
        settings={settings}
        isLoading={isLoading}
        itemsPerPage={itemsPerPage}
        currentPage={currentPage}
        totalPages={totalPages}
        onActivitySelect={setSelectedActivity}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handleItemsPerPageChange}
      />

      {/* Activity Details */}
      <FullLogActivityDetails
        activity={selectedActivity}
        settings={settings}
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />

      {/* Edit Forms */}
      {selectedActivity && (
        <>
          <SleepForm
            isOpen={editModalType === 'sleep'}
            onClose={() => {
              setEditModalType(null);
              setSelectedActivity(null);
            }}
            isSleeping={false}
            onSleepToggle={() => {}}
            babyId={selectedActivity.babyId}
            initialTime={'startTime' in selectedActivity && selectedActivity.startTime ? String(selectedActivity.startTime) : getActivityTime(selectedActivity)}
            activity={'duration' in selectedActivity && 'type' in selectedActivity ? selectedActivity : undefined}
            onSuccess={() => {
              setEditModalType(null);
              setSelectedActivity(null);
              onActivityDeleted?.();
            }}
          />
          <FeedForm
            isOpen={editModalType === 'feed'}
            onClose={() => {
              setEditModalType(null);
              setSelectedActivity(null);
            }}
            babyId={selectedActivity.babyId}
            initialTime={'time' in selectedActivity && selectedActivity.time ? String(selectedActivity.time) : getActivityTime(selectedActivity)}
            activity={'amount' in selectedActivity && 'type' in selectedActivity ? selectedActivity : undefined}
            onSuccess={() => {
              setEditModalType(null);
              setSelectedActivity(null);
              onActivityDeleted?.();
            }}
          />
          <DiaperForm
            isOpen={editModalType === 'diaper'}
            onClose={() => {
              setEditModalType(null);
              setSelectedActivity(null);
            }}
            babyId={selectedActivity.babyId}
            initialTime={'time' in selectedActivity && selectedActivity.time ? String(selectedActivity.time) : getActivityTime(selectedActivity)}
            activity={'condition' in selectedActivity && 'type' in selectedActivity ? selectedActivity : undefined}
            onSuccess={() => {
              setEditModalType(null);
              setSelectedActivity(null);
              onActivityDeleted?.();
            }}
          />
          <NoteForm
            isOpen={editModalType === 'note'}
            onClose={() => {
              setEditModalType(null);
              setSelectedActivity(null);
            }}
            babyId={selectedActivity.babyId}
            initialTime={'time' in selectedActivity && selectedActivity.time ? String(selectedActivity.time) : getActivityTime(selectedActivity)}
            activity={'content' in selectedActivity && 'time' in selectedActivity ? selectedActivity : undefined}
            onSuccess={() => {
              setEditModalType(null);
              setSelectedActivity(null);
              onActivityDeleted?.();
            }}
          />
          <BathForm
            isOpen={editModalType === 'bath'}
            onClose={() => {
              setEditModalType(null);
              setSelectedActivity(null);
            }}
            babyId={selectedActivity.babyId}
            initialTime={'time' in selectedActivity && selectedActivity.time ? String(selectedActivity.time) : getActivityTime(selectedActivity)}
            activity={'soapUsed' in selectedActivity ? selectedActivity : undefined}
            onSuccess={() => {
              setEditModalType(null);
              setSelectedActivity(null);
              onActivityDeleted?.();
            }}
          />
          <PumpForm
            isOpen={editModalType === 'pump'}
            onClose={() => {
              setEditModalType(null);
              setSelectedActivity(null);
            }}
            babyId={selectedActivity.babyId}
            initialTime={'startTime' in selectedActivity && selectedActivity.startTime ? String(selectedActivity.startTime) : getActivityTime(selectedActivity)}
            activity={
              ('leftAmount' in selectedActivity || 'rightAmount' in selectedActivity) ? 
                (selectedActivity as unknown as PumpLogResponse) : 
                undefined
            }
            onSuccess={() => {
              setEditModalType(null);
              setSelectedActivity(null);
              onActivityDeleted?.();
            }}
          />
          <MilestoneForm
            isOpen={editModalType === 'milestone'}
            onClose={() => {
              setEditModalType(null);
              setSelectedActivity(null);
            }}
            babyId={selectedActivity.babyId}
            initialTime={'date' in selectedActivity && selectedActivity.date ? String(selectedActivity.date) : getActivityTime(selectedActivity)}
            activity={'title' in selectedActivity && 'category' in selectedActivity ? selectedActivity : undefined}
            onSuccess={() => {
              setEditModalType(null);
              setSelectedActivity(null);
              onActivityDeleted?.();
            }}
          />
          <MeasurementForm
            isOpen={editModalType === 'measurement'}
            onClose={() => {
              setEditModalType(null);
              setSelectedActivity(null);
            }}
            babyId={selectedActivity.babyId}
            initialTime={'date' in selectedActivity && selectedActivity.date ? String(selectedActivity.date) : getActivityTime(selectedActivity)}
            activity={'value' in selectedActivity && 'unit' in selectedActivity ? selectedActivity : undefined}
            onSuccess={() => {
              setEditModalType(null);
              setSelectedActivity(null);
              onActivityDeleted?.();
            }}
          />
          <GiveMedicineForm
            isOpen={editModalType === 'medicine'}
            onClose={() => {
              setEditModalType(null);
              setSelectedActivity(null);
            }}
            babyId={selectedActivity.babyId}
            initialTime={'time' in selectedActivity && selectedActivity.time ? String(selectedActivity.time) : getActivityTime(selectedActivity)}
            activity={'doseAmount' in selectedActivity && 'medicineId' in selectedActivity ? 
              (selectedActivity as unknown as MedicineLogResponse) : undefined}
            onSuccess={() => {
              setEditModalType(null);
              setSelectedActivity(null);
              onActivityDeleted?.();
            }}
          />
        </>
      )}
    </div>
  );
};

export default FullLogTimeline;
