'use client';

import React, { useMemo } from 'react';
import {
  Moon,
  Sun,
  Utensils,
  Bath,
  Edit,
  PillBottle,
  Trophy,
  Ruler,
  LampWallDown,
  MapPin,
  Loader2,
  Icon
} from 'lucide-react';
import { diaper, bottleBaby } from '@lucide/lab';
import { cn } from '@/src/lib/utils';
import { Card, CardContent } from '@/src/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/src/components/ui/accordion';
import { styles } from './reports.styles';
import {
  StatsTabProps,
  ActivityType,
  SleepStats,
  FeedingStats,
  DiaperStats,
  OtherStats,
  LocationStat,
  MedicineStat,
  CombinedStats,
} from './reports.types';

/**
 * StatsTab Component
 *
 * Displays statistical summaries of baby activities with collapsible sections
 * for sleep, feeding, diapers, and other activities.
 */
const StatsTab: React.FC<StatsTabProps> = ({
  activities,
  dateRange,
  isLoading
}) => {
  // Helper function to format minutes into hours and minutes
  const formatMinutes = (minutes: number): string => {
    if (minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  // Calculate all statistics from activities
  const stats = useMemo((): CombinedStats => {
    if (!activities.length || !dateRange.from || !dateRange.to) {
      return {
        sleep: {
          totalSleepMinutes: 0,
          avgNapMinutes: 0,
          avgNightSleepMinutes: 0,
          avgNightWakings: 0,
          napLocations: [],
          nightLocations: [],
        },
        feeding: {
          totalFeeds: 0,
          bottleFeeds: { count: 0, amounts: {}, avgByType: [] },
          breastFeeds: { count: 0, leftMinutes: 0, rightMinutes: 0, leftCount: 0, rightCount: 0, avgLeftMinutes: 0, avgRightMinutes: 0 },
          solidsFeeds: { count: 0, amounts: {}, avgByFood: [] },
        },
        diaper: {
          totalChanges: 0,
          wetCount: 0,
          poopCount: 0,
          avgWetPerDay: 0,
          avgPoopPerDay: 0,
          daysInRange: 1,
        },
        other: {
          bathCount: 0,
          pumpCount: 0,
          noteCount: 0,
          milestoneCount: 0,
          measurementCount: 0,
          medicines: [],
        },
      };
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    // Calculate number of days in range
    const daysInRange = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Sleep tracking
    let totalSleepMinutes = 0;
    let totalNapMinutes = 0;
    let napCount = 0;
    // Track night sleep by night date to calculate total per night and wakings
    const nightSleepByNight: Record<string, { totalMinutes: number; sessions: number }> = {};
    const napLocationMap: Record<string, { count: number; totalMinutes: number }> = {};
    const nightLocationMap: Record<string, { count: number; totalMinutes: number }> = {};

    // Feeding tracking
    let totalFeeds = 0;
    let bottleFeedCount = 0;
    const bottleAmounts: Record<string, number> = {};
    // Track by bottle type for averages
    const bottleByType: Record<string, { count: number; totalAmount: number; unit: string }> = {};
    let breastFeedCount = 0;
    let leftBreastMinutes = 0;
    let rightBreastMinutes = 0;
    let leftBreastCount = 0;
    let rightBreastCount = 0;
    let solidsFeedCount = 0;
    const solidsAmounts: Record<string, number> = {};
    // Track by food type for averages
    const solidsByFood: Record<string, { count: number; totalAmount: number; unit: string }> = {};

    // Diaper tracking
    let totalDiaperChanges = 0;
    let wetCount = 0;
    let poopCount = 0;

    // Other tracking
    let bathCount = 0;
    let pumpCount = 0;
    let noteCount = 0;
    let milestoneCount = 0;
    let measurementCount = 0;
    const medicineMap: Record<string, { count: number; total: number; unit: string }> = {};

    activities.forEach((activity) => {
      // Sleep activities
      if ('duration' in activity && 'startTime' in activity && 'type' in activity) {
        const activityType = (activity as any).type;
        if (activityType === 'NAP' || activityType === 'NIGHT_SLEEP') {
          const sleepActivity = activity as any;
          const startTime = new Date(sleepActivity.startTime);
          const endTime = sleepActivity.endTime ? new Date(sleepActivity.endTime) : null;

          if (endTime) {
            // Calculate overlap with date range
            const overlapStart = Math.max(startTime.getTime(), startDate.getTime());
            const overlapEnd = Math.min(endTime.getTime(), endDate.getTime());

            if (overlapEnd > overlapStart) {
              const sleepMinutes = Math.floor((overlapEnd - overlapStart) / (1000 * 60));
              totalSleepMinutes += sleepMinutes;

              const location = sleepActivity.location || 'Unknown';

              // Determine if nap or night sleep based on start hour
              const startHour = startTime.getHours();
              const isNightSleep = startHour >= 19 || startHour < 7;

              if (isNightSleep) {
                // Track night location
                if (!nightLocationMap[location]) {
                  nightLocationMap[location] = { count: 0, totalMinutes: 0 };
                }
                nightLocationMap[location].count++;
                nightLocationMap[location].totalMinutes += sleepMinutes;

                // Group night sleep by the "night" it belongs to
                // Sleep starting 7pm-midnight belongs to that night
                // Sleep starting midnight-7am belongs to the previous night
                let nightDate = new Date(startTime);
                if (startHour < 7) {
                  // Early morning sleep - belongs to previous night
                  nightDate.setDate(nightDate.getDate() - 1);
                }
                const nightKey = nightDate.toISOString().split('T')[0];

                if (!nightSleepByNight[nightKey]) {
                  nightSleepByNight[nightKey] = { totalMinutes: 0, sessions: 0 };
                }
                nightSleepByNight[nightKey].totalMinutes += sleepMinutes;
                nightSleepByNight[nightKey].sessions++;
              } else {
                totalNapMinutes += sleepMinutes;
                napCount++;

                // Track nap location
                if (!napLocationMap[location]) {
                  napLocationMap[location] = { count: 0, totalMinutes: 0 };
                }
                napLocationMap[location].count++;
                napLocationMap[location].totalMinutes += sleepMinutes;
              }
            }
          }
        }
      }

      // Feed activities
      if ('type' in activity && 'time' in activity) {
        const activityType = (activity as any).type;

        if (activityType === 'BOTTLE' || activityType === 'BREAST' || activityType === 'SOLIDS') {
          totalFeeds++;

          if (activityType === 'BOTTLE') {
            bottleFeedCount++;
            const feedActivity = activity as any;
            if (feedActivity.amount) {
              const unit = feedActivity.unitAbbr || 'oz';
              if (!bottleAmounts[unit]) bottleAmounts[unit] = 0;
              bottleAmounts[unit] += feedActivity.amount;

              // Track by bottle type
              const bottleType = feedActivity.bottleType || 'Uncategorized';
              if (!bottleByType[bottleType]) {
                bottleByType[bottleType] = { count: 0, totalAmount: 0, unit };
              }
              bottleByType[bottleType].count++;
              bottleByType[bottleType].totalAmount += feedActivity.amount;
            }
          } else if (activityType === 'BREAST') {
            breastFeedCount++;
            const feedActivity = activity as any;
            let feedMinutes = 0;
            if (feedActivity.feedDuration) {
              feedMinutes = Math.floor(feedActivity.feedDuration / 60);
            } else if (feedActivity.amount) {
              feedMinutes = feedActivity.amount;
            }

            if (feedActivity.side === 'LEFT') {
              leftBreastMinutes += feedMinutes;
              leftBreastCount++;
            } else if (feedActivity.side === 'RIGHT') {
              rightBreastMinutes += feedMinutes;
              rightBreastCount++;
            }
          } else if (activityType === 'SOLIDS') {
            solidsFeedCount++;
            const feedActivity = activity as any;
            if (feedActivity.amount) {
              const unit = feedActivity.unitAbbr || 'g';
              if (!solidsAmounts[unit]) solidsAmounts[unit] = 0;
              solidsAmounts[unit] += feedActivity.amount;

              // Track by food type
              const foodType = feedActivity.food || 'Uncategorized';
              if (!solidsByFood[foodType]) {
                solidsByFood[foodType] = { count: 0, totalAmount: 0, unit };
              }
              solidsByFood[foodType].count++;
              solidsByFood[foodType].totalAmount += feedActivity.amount;
            }
          }
        }
      }

      // Diaper activities
      if ('condition' in activity && 'type' in activity) {
        totalDiaperChanges++;
        const diaperActivity = activity as any;

        if (diaperActivity.type === 'WET') {
          wetCount++;
        } else if (diaperActivity.type === 'DIRTY') {
          poopCount++;
        } else if (diaperActivity.type === 'BOTH') {
          wetCount++;
          poopCount++;
        }
      }

      // Bath activities
      if ('soapUsed' in activity) {
        bathCount++;
      }

      // Pump activities
      if ('leftAmount' in activity || 'rightAmount' in activity) {
        pumpCount++;
      }

      // Note activities
      if ('content' in activity && !('title' in activity)) {
        noteCount++;
      }

      // Milestone activities
      if ('title' in activity && 'category' in activity) {
        milestoneCount++;
      }

      // Measurement activities
      if ('value' in activity && 'unit' in activity && !('doseAmount' in activity)) {
        measurementCount++;
      }

      // Medicine activities
      if ('doseAmount' in activity && 'medicineId' in activity) {
        const medActivity = activity as any;
        let medicineName = 'Unknown';
        if (medActivity.medicine?.name) {
          medicineName = medActivity.medicine.name;
        }

        if (!medicineMap[medicineName]) {
          medicineMap[medicineName] = {
            count: 0,
            total: 0,
            unit: medActivity.unitAbbr || '',
          };
        }
        medicineMap[medicineName].count++;
        medicineMap[medicineName].total += medActivity.doseAmount || 0;
      }
    });

    // Calculate averages
    const avgNapMinutes = napCount > 0 ? Math.round(totalNapMinutes / napCount) : 0;

    // Calculate night sleep stats from grouped data
    const nightsCount = Object.keys(nightSleepByNight).length;
    let totalNightSleepMinutes = 0;
    let totalWakings = 0;

    Object.values(nightSleepByNight).forEach((night) => {
      totalNightSleepMinutes += night.totalMinutes;
      // Night wakings = number of sleep sessions - 1 (first sleep of night isn't a "waking")
      // If baby sleeps 4 times during a night, they woke up 3 times
      totalWakings += Math.max(0, night.sessions - 1);
    });

    // Average night sleep is total sleep divided by number of nights
    const avgNightSleepMinutes = nightsCount > 0 ? Math.round(totalNightSleepMinutes / nightsCount) : 0;
    const avgNightWakings = nightsCount > 0 ? Math.round((totalWakings / nightsCount) * 10) / 10 : 0;

    // Convert location maps to sorted arrays
    const napLocations: LocationStat[] = Object.entries(napLocationMap)
      .map(([location, data]) => ({
        location,
        count: data.count,
        totalMinutes: data.totalMinutes,
      }))
      .sort((a, b) => b.count - a.count);

    const nightLocations: LocationStat[] = Object.entries(nightLocationMap)
      .map(([location, data]) => ({
        location,
        count: data.count,
        totalMinutes: data.totalMinutes,
      }))
      .sort((a, b) => b.count - a.count);

    // Convert medicine map to sorted array
    const medicines: MedicineStat[] = Object.entries(medicineMap)
      .map(([name, data]) => ({
        name,
        count: data.count,
        totalAmount: data.total,
        unit: data.unit,
      }))
      .sort((a, b) => b.count - a.count);

    // Calculate averages for feeding
    const bottleAvgByType = Object.entries(bottleByType).map(([type, data]) => ({
      type,
      avgAmount: data.count > 0 ? data.totalAmount / data.count : 0,
      unit: data.unit,
      count: data.count,
    })).sort((a, b) => b.count - a.count);

    const avgLeftBreastMinutes = leftBreastCount > 0 ? Math.round(leftBreastMinutes / leftBreastCount) : 0;
    const avgRightBreastMinutes = rightBreastCount > 0 ? Math.round(rightBreastMinutes / rightBreastCount) : 0;

    const solidsAvgByFood = Object.entries(solidsByFood).map(([food, data]) => ({
      food,
      avgAmount: data.count > 0 ? data.totalAmount / data.count : 0,
      unit: data.unit,
      count: data.count,
    })).sort((a, b) => b.count - a.count);

    // Calculate average diapers per day
    const avgWetPerDay = daysInRange > 0 ? Math.round((wetCount / daysInRange) * 10) / 10 : 0;
    const avgPoopPerDay = daysInRange > 0 ? Math.round((poopCount / daysInRange) * 10) / 10 : 0;

    return {
      sleep: {
        totalSleepMinutes,
        avgNapMinutes,
        avgNightSleepMinutes,
        avgNightWakings,
        napLocations,
        nightLocations,
      },
      feeding: {
        totalFeeds,
        bottleFeeds: { count: bottleFeedCount, amounts: bottleAmounts, avgByType: bottleAvgByType },
        breastFeeds: {
          count: breastFeedCount,
          leftMinutes: leftBreastMinutes,
          rightMinutes: rightBreastMinutes,
          leftCount: leftBreastCount,
          rightCount: rightBreastCount,
          avgLeftMinutes: avgLeftBreastMinutes,
          avgRightMinutes: avgRightBreastMinutes,
        },
        solidsFeeds: { count: solidsFeedCount, amounts: solidsAmounts, avgByFood: solidsAvgByFood },
      },
      diaper: {
        totalChanges: totalDiaperChanges,
        wetCount,
        poopCount,
        avgWetPerDay,
        avgPoopPerDay,
        daysInRange,
      },
      other: {
        bathCount,
        pumpCount,
        noteCount,
        milestoneCount,
        measurementCount,
        medicines,
      },
    };
  }, [activities, dateRange]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(styles.loadingContainer, "reports-loading-container")}>
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <p className={cn(styles.loadingText, "reports-loading-text")}>Loading statistics...</p>
      </div>
    );
  }

  // Empty state
  if (!activities.length) {
    return (
      <div className={cn(styles.emptyContainer, "reports-empty-container")}>
        <p className={cn(styles.emptyText, "reports-empty-text")}>
          No activities found for the selected date range.
        </p>
      </div>
    );
  }

  // Format amounts for display
  const formatAmounts = (amounts: Record<string, number>): string => {
    return Object.entries(amounts)
      .map(([unit, amount]) => `${amount.toFixed(1)} ${unit}`)
      .join(', ');
  };

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={['sleep', 'feeding', 'diaper', 'other']}>
        {/* Sleep Section */}
        <AccordionItem value="sleep">
          <AccordionTrigger className={cn(styles.accordionTrigger, "reports-accordion-trigger")}>
            <Moon className={cn(styles.accordionTriggerIcon, "reports-accordion-trigger-icon reports-icon-sleep")} />
            <span>Sleep Statistics</span>
          </AccordionTrigger>
          <AccordionContent className={styles.accordionContent}>
            <div className={styles.statsGrid}>
              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <Sun className={cn(styles.statCardIcon, "text-amber-500")} />
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {formatMinutes(stats.sleep.avgNapMinutes)}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>Avg Nap Duration</div>
                </CardContent>
              </Card>

              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <Moon className={cn(styles.statCardIcon, "text-indigo-500")} />
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {formatMinutes(stats.sleep.avgNightSleepMinutes)}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>Avg Night Sleep</div>
                </CardContent>
              </Card>

              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <Moon className={cn(styles.statCardIcon, "text-purple-500")} />
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {stats.sleep.avgNightWakings}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>Avg Night Wakings</div>
                </CardContent>
              </Card>
            </div>

            {/* Nap Locations */}
            {stats.sleep.napLocations.length > 0 && (
              <div className="mt-4">
                <h4 className={cn(styles.sectionTitle, "reports-section-title")}>
                  <MapPin className={styles.sectionTitleIcon} />
                  Popular Nap Locations
                </h4>
                <div className={styles.locationList}>
                  {stats.sleep.napLocations.slice(0, 5).map((loc) => (
                    <div key={loc.location} className={cn(styles.locationItem, "reports-location-item")}>
                      <span className={cn(styles.locationName, "reports-location-name")}>{loc.location}</span>
                      <span className={cn(styles.locationCount, "reports-location-count")}>
                        {loc.count}x ({formatMinutes(loc.totalMinutes)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Night Sleep Locations */}
            {stats.sleep.nightLocations.length > 0 && (
              <div className="mt-4">
                <h4 className={cn(styles.sectionTitle, "reports-section-title")}>
                  <MapPin className={styles.sectionTitleIcon} />
                  Popular Night Sleep Locations
                </h4>
                <div className={styles.locationList}>
                  {stats.sleep.nightLocations.slice(0, 5).map((loc) => (
                    <div key={loc.location} className={cn(styles.locationItem, "reports-location-item")}>
                      <span className={cn(styles.locationName, "reports-location-name")}>{loc.location}</span>
                      <span className={cn(styles.locationCount, "reports-location-count")}>
                        {loc.count}x ({formatMinutes(loc.totalMinutes)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Feeding Section */}
        <AccordionItem value="feeding">
          <AccordionTrigger className={cn(styles.accordionTrigger, "reports-accordion-trigger")}>
            <Icon iconNode={bottleBaby} className={cn(styles.accordionTriggerIcon, "reports-accordion-trigger-icon reports-icon-feed")} />
            <span>Feeding Statistics</span>
          </AccordionTrigger>
          <AccordionContent className={styles.accordionContent}>
            <div className={styles.statsGrid}>
              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <Icon iconNode={bottleBaby} className={cn(styles.statCardIcon, "text-blue-400")} />
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {stats.feeding.bottleFeeds.count}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>Bottle Feeds</div>
                  {stats.feeding.bottleFeeds.avgByType.length > 0 && (
                    <div className={cn(styles.statCardSubLabel, "reports-stat-card-sublabel")}>
                      {stats.feeding.bottleFeeds.avgByType.map((bt, idx) => (
                        <span key={bt.type}>
                          {bt.type}: {bt.avgAmount.toFixed(1)} {bt.unit} avg
                          {idx < stats.feeding.bottleFeeds.avgByType.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <Utensils className={cn(styles.statCardIcon, "text-pink-400")} />
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {stats.feeding.breastFeeds.count}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>Breast Feeds</div>
                  {(stats.feeding.breastFeeds.leftCount > 0 || stats.feeding.breastFeeds.rightCount > 0) && (
                    <div className={cn(styles.statCardSubLabel, "reports-stat-card-sublabel")}>
                      L: {formatMinutes(stats.feeding.breastFeeds.avgLeftMinutes)} avg, R: {formatMinutes(stats.feeding.breastFeeds.avgRightMinutes)} avg
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <Utensils className={cn(styles.statCardIcon, "text-orange-400")} />
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {stats.feeding.solidsFeeds.count}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>Solids</div>
                  {stats.feeding.solidsFeeds.avgByFood.length > 0 && (
                    <div className={cn(styles.statCardSubLabel, "reports-stat-card-sublabel")}>
                      {stats.feeding.solidsFeeds.avgByFood.slice(0, 3).map((sf, idx) => (
                        <span key={sf.food}>
                          {sf.food}: {sf.avgAmount.toFixed(1)} {sf.unit} avg
                          {idx < Math.min(stats.feeding.solidsFeeds.avgByFood.length, 3) - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Diaper Section */}
        <AccordionItem value="diaper">
          <AccordionTrigger className={cn(styles.accordionTrigger, "reports-accordion-trigger")}>
            <Icon iconNode={diaper} className={cn(styles.accordionTriggerIcon, "reports-accordion-trigger-icon reports-icon-diaper-wet")} />
            <span>Diaper Statistics</span>
          </AccordionTrigger>
          <AccordionContent className={styles.accordionContent}>
            <div className={styles.statsGrid}>
              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <Icon iconNode={diaper} className={cn(styles.statCardIcon, "text-teal-500")} />
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {stats.diaper.wetCount}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>Wet Diapers</div>
                  <div className={cn(styles.statCardSubLabel, "reports-stat-card-sublabel")}>
                    {stats.diaper.avgWetPerDay}/day avg
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <Icon iconNode={diaper} className={cn(styles.statCardIcon, "text-amber-600")} />
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {stats.diaper.poopCount}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>Poopy Diapers</div>
                  <div className={cn(styles.statCardSubLabel, "reports-stat-card-sublabel")}>
                    {stats.diaper.avgPoopPerDay}/day avg
                  </div>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Other Activities Section */}
        <AccordionItem value="other">
          <AccordionTrigger className={cn(styles.accordionTrigger, "reports-accordion-trigger")}>
            <Bath className={cn(styles.accordionTriggerIcon, "reports-accordion-trigger-icon reports-icon-bath")} />
            <span>Other Activities</span>
          </AccordionTrigger>
          <AccordionContent className={styles.accordionContent}>
            <div className={styles.statsGrid}>
              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <Bath className={cn(styles.statCardIcon, "text-orange-400")} />
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {stats.other.bathCount}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>Baths</div>
                </CardContent>
              </Card>

              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <LampWallDown className={cn(styles.statCardIcon, "text-purple-400")} />
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {stats.other.pumpCount}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>Pump Sessions</div>
                </CardContent>
              </Card>

              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <Edit className={cn(styles.statCardIcon, "text-yellow-400")} />
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {stats.other.noteCount}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>Notes</div>
                </CardContent>
              </Card>

              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <Trophy className={cn(styles.statCardIcon, "text-blue-500")} />
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {stats.other.milestoneCount}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>Milestones</div>
                </CardContent>
              </Card>

              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <Ruler className={cn(styles.statCardIcon, "text-red-400")} />
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {stats.other.measurementCount}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>Measurements</div>
                </CardContent>
              </Card>
            </div>

            {/* Medicine breakdown */}
            {stats.other.medicines.length > 0 && (
              <div className="mt-4">
                <h4 className={cn(styles.sectionTitle, "reports-section-title")}>
                  <PillBottle className={styles.sectionTitleIcon} />
                  Medicine
                </h4>
                <div className={styles.medicineList}>
                  {stats.other.medicines.map((med) => (
                    <div key={med.name} className={cn(styles.medicineItem, "reports-medicine-item")}>
                      <span className={cn(styles.medicineName, "reports-medicine-name")}>{med.name}</span>
                      <span className={cn(styles.medicineDetails, "reports-medicine-details")}>
                        {med.count}x ({med.totalAmount.toFixed(1)} {med.unit})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default StatsTab;
