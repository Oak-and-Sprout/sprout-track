import { Settings } from '@prisma/client';
import { useState, useEffect, useMemo, useRef } from 'react';
import SleepForm from '@/src/components/forms/SleepForm';
import FeedForm from '@/src/components/forms/FeedForm';
import DiaperForm from '@/src/components/forms/DiaperForm';
import NoteForm from '@/src/components/forms/NoteForm';
import BathForm from '@/src/components/forms/BathForm';
import PumpForm from '@/src/components/forms/PumpForm';
import MilestoneForm from '@/src/components/forms/MilestoneForm';
import MeasurementForm from '@/src/components/forms/MeasurementForm';
import GiveMedicineForm from '@/src/components/forms/GiveMedicineForm';
import { ActivityType, FilterType, TimelineProps } from '../types';
import TimelineV2DailyStats from './TimelineV2DailyStats';
import TimelineV2ActivityList from './TimelineV2ActivityList';
import TimelineActivityDetails from '../TimelineActivityDetails';
import { getActivityEndpoint, getActivityTime } from '../utils';
import { PumpLogResponse } from '@/app/api/types';

const TimelineV2 = ({ activities, onActivityDeleted }: TimelineProps) => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);
  const [editModalType, setEditModalType] = useState<'sleep' | 'feed' | 'diaper' | 'medicine' | 'note' | 'bath' | 'pump' | 'milestone' | 'measurement' | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const [dateFilteredActivities, setDateFilteredActivities] = useState<ActivityType[]>([]);
  
  const [isLoadingActivities, setIsLoadingActivities] = useState<boolean>(false);
  const [isFetchAnimated, setIsFetchAnimated] = useState<boolean>(true);
  const lastRefreshTimestamp = useRef<number>(Date.now());
  const wasIdle = useRef<boolean>(false);

  const babyId = useMemo(() => (activities.length > 0 ? activities[0].babyId : undefined), [activities]);

  const fetchActivitiesForDate = async (babyId: string, date: Date, isAnimated: boolean) => {
    setIsFetchAnimated(isAnimated);
    if (isAnimated) {
      setIsLoadingActivities(true);
    }

    try {
      const timestamp = new Date().getTime();

      // Calculate start of day in user's timezone
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const startDateISO = startOfDay.toISOString();

      // Calculate end of day in user's timezone
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      const endDateISO = endOfDay.toISOString();
      
      const urlPath = window.location.pathname;
      const familySlugMatch = urlPath.match(/^\/([^\/]+)\//);
      const familySlug = familySlugMatch ? familySlugMatch[1] : null;
      
      let url = `/api/timeline?babyId=${babyId}&startDate=${encodeURIComponent(startDateISO)}&endDate=${encodeURIComponent(endDateISO)}&_t=${timestamp}`;
      
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Expires': '0',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDateFilteredActivities(data.data);
          lastRefreshTimestamp.current = Date.now();
        } else {
          setDateFilteredActivities([]);
        }
      } else {
        console.error('Failed to fetch activities:', await response.text());
        setDateFilteredActivities([]);
      }
    } catch (error) {
      console.error('Error fetching activities for date:', error);
      setDateFilteredActivities([]);
    } finally {
      if (isAnimated) {
        setIsLoadingActivities(false);
      }
    }
  };

  const handleFormSuccess = () => {
    setEditModalType(null);
    setSelectedActivity(null);

    if (babyId) {
      fetchActivitiesForDate(babyId, selectedDate, true);
    }

    if (onActivityDeleted) {
      onActivityDeleted();
    }
  };

  const handleDateSelection = (newDate: Date) => {
    setSelectedDate(newDate);
    if (babyId) {
      fetchActivitiesForDate(babyId, newDate, true);
      if (onActivityDeleted) {
        onActivityDeleted(newDate);
      }
    }
  };

  const handleDateChange = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    handleDateSelection(newDate);
  };

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(activeFilter === filter ? null : filter);
  };
  
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
  
  useEffect(() => {
    if (babyId) {
      fetchActivitiesForDate(babyId, selectedDate, true);
    } else {
      setDateFilteredActivities(activities);
    }
  }, [activities, selectedDate, babyId]);

  useEffect(() => {
    if (!babyId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User came back to the tab, refresh immediately
        fetchActivitiesForDate(babyId, selectedDate, false);
      }
    };

    const poll = setInterval(() => {
      const idleThreshold = 5 * 60 * 1000; // 5 minutes
      const activeRefreshRate = 30 * 1000; // 30 seconds

      const idleTime = Date.now() - parseInt(localStorage.getItem('unlockTime') || `${Date.now()}`);
      const isCurrentlyIdle = idleTime >= idleThreshold;
      const timeSinceLastRefresh = Date.now() - lastRefreshTimestamp.current;

      // Case 1: User just came back from an idle state (was idle, now is not)
      if (wasIdle.current && !isCurrentlyIdle) {
        fetchActivitiesForDate(babyId, selectedDate, false);
      }
      // Case 2: User is active and the regular refresh interval has passed
      else if (!isCurrentlyIdle && timeSinceLastRefresh > activeRefreshRate) {
        fetchActivitiesForDate(babyId, selectedDate, false);
      }

      // Update the idle state for the next check
      wasIdle.current = isCurrentlyIdle;
    }, 10000); // Check status every 10 seconds

    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(poll);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [babyId, selectedDate]);

  const sortedActivities = useMemo(() => {
    const filtered = !activeFilter || activeFilter === null
      ? dateFilteredActivities
      : dateFilteredActivities.filter(activity => {
          switch (activeFilter) {
            case 'sleep':
              return 'duration' in activity;
            case 'feed':
              return 'amount' in activity;
            case 'diaper':
              return 'condition' in activity;
            case 'poop':
              return 'condition' in activity && 'type' in activity && 
                     (activity.type === 'DIRTY' || activity.type === 'BOTH');
            case 'medicine':
              return 'doseAmount' in activity && 'medicineId' in activity;
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
            default:
              return true;
          }
        });

    const sorted = [...filtered].sort((a, b) => {
      const timeA = new Date(getActivityTime(a));
      const timeB = new Date(getActivityTime(b));
      return timeB.getTime() - timeA.getTime();
    });

    return sorted;
  }, [dateFilteredActivities, activeFilter]);

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

  const handleEdit = (activity: ActivityType, type: 'sleep' | 'feed' | 'diaper' | 'medicine' | 'note' | 'bath' | 'pump' | 'milestone' | 'measurement') => {
    setSelectedActivity(activity);
    setEditModalType(type);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-192px)]">
      {/* Daily Stats with Integrated Date Navigation */}
      <TimelineV2DailyStats
        activities={dateFilteredActivities}
        date={selectedDate}
        isLoading={isLoadingActivities}
        activeFilter={activeFilter}
        onDateChange={handleDateChange}
        onDateSelection={handleDateSelection}
        onFilterChange={handleFilterChange}
      />

      {/* Activity List */}
      <TimelineV2ActivityList
        activities={sortedActivities}
        settings={settings}
        isLoading={isLoadingActivities}
        isAnimated={isFetchAnimated}
        selectedDate={selectedDate}
        onActivitySelect={(activity) => setSelectedActivity(activity)}
      />

      {/* Activity Details */}
      <TimelineActivityDetails
        activity={selectedActivity}
        settings={settings}
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />

      {/* Edit Forms */}
      {selectedActivity && editModalType && (
        <>
          <SleepForm
            isOpen={editModalType === 'sleep'}
            onClose={() => setEditModalType(null)}
            babyId={selectedActivity.babyId}
            initialTime={getActivityTime(selectedActivity)}
            activity={'duration' in selectedActivity && 'type' in selectedActivity ? selectedActivity : undefined}
            onSuccess={handleFormSuccess}
            isSleeping={false}
            onSleepToggle={() => {}}
          />
          <FeedForm
            isOpen={editModalType === 'feed'}
            onClose={() => setEditModalType(null)}
            babyId={selectedActivity.babyId}
            initialTime={getActivityTime(selectedActivity)}
            activity={'amount' in selectedActivity ? selectedActivity : undefined}
            onSuccess={handleFormSuccess}
          />
          <DiaperForm
            isOpen={editModalType === 'diaper'}
            onClose={() => setEditModalType(null)}
            babyId={selectedActivity.babyId}
            initialTime={getActivityTime(selectedActivity)}
            activity={'condition' in selectedActivity ? selectedActivity : undefined}
            onSuccess={handleFormSuccess}
          />
          <NoteForm
            isOpen={editModalType === 'note'}
            onClose={() => setEditModalType(null)}
            babyId={selectedActivity.babyId}
            initialTime={getActivityTime(selectedActivity)}
            activity={'content' in selectedActivity ? selectedActivity : undefined}
            onSuccess={handleFormSuccess}
          />
          <BathForm
            isOpen={editModalType === 'bath'}
            onClose={() => setEditModalType(null)}
            babyId={selectedActivity.babyId}
            initialTime={getActivityTime(selectedActivity)}
            activity={'soapUsed' in selectedActivity ? selectedActivity : undefined}
            onSuccess={handleFormSuccess}
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
            onSuccess={handleFormSuccess}
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
            onSuccess={handleFormSuccess}
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
            onSuccess={handleFormSuccess}
          />
          <GiveMedicineForm
            isOpen={editModalType === 'medicine'}
            onClose={() => {
              setEditModalType(null);
              setSelectedActivity(null);
            }}
            babyId={selectedActivity.babyId}
            initialTime={'doseAmount' in selectedActivity && 'time' in selectedActivity ? String(selectedActivity.time) : getActivityTime(selectedActivity)}
            activity={'doseAmount' in selectedActivity && 'medicineId' in selectedActivity ? selectedActivity : undefined}
            onSuccess={handleFormSuccess}
          />
        </>
      )}
    </div>
  );
};

export default TimelineV2;

