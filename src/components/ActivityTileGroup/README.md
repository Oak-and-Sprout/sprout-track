# ActivityTileGroup Component

A container component that organizes and displays a group of activity tiles for the Baby Tracker application. This component encapsulates the activity buttons displayed in the log entry page along with their status indicators.

## Features

- Groups activity tiles (Sleep, Feed, Diaper, Note, Bath, Pump) in a consistent layout
- Handles status bubble displays for each activity type
- Manages activity button interactions
- Maintains consistent styling across all activity buttons
- Follows the container/presentational pattern
- Designed for cross-platform compatibility
- Handles timezone differences and DST changes correctly

## Usage

### Basic Usage

```tsx
import { ActivityTileGroup } from '@/src/components/features/ActivityTileGroup';

// Example usage in a page component
function LogEntryPage() {
  const { selectedBaby, sleepingBabies } = useBaby();
  const [sleepStartTime, setSleepStartTime] = useState<Record<string, Date>>({});
  const [lastSleepEndTime, setLastSleepEndTime] = useState<Record<string, Date>>({});
  const [lastFeedTime, setLastFeedTime] = useState<Record<string, Date>>({});
  const [lastDiaperTime, setLastDiaperTime] = useState<Record<string, Date>>({});
  
  const updateUnlockTimer = () => {
    // Logic to update unlock timer
  };
  
  return (
    <div>
      {selectedBaby?.id && (
        <ActivityTileGroup
          selectedBaby={selectedBaby}
          sleepingBabies={sleepingBabies}
          sleepStartTime={sleepStartTime}
          lastSleepEndTime={lastSleepEndTime}
          lastFeedTime={lastFeedTime}
          lastDiaperTime={lastDiaperTime}
          updateUnlockTimer={updateUnlockTimer}
          onSleepClick={() => setShowSleepModal(true)}
          onFeedClick={() => setShowFeedModal(true)}
          onDiaperClick={() => setShowDiaperModal(true)}
          onNoteClick={() => setShowNoteModal(true)}
        />
      )}
    </div>
  );
}
```

## Component API

### ActivityTileGroup

Main component for displaying a group of activity tiles.

#### Props

| Prop | Type | Description | Default |
|------|------|-------------|---------|
| `selectedBaby` | `{ id: string; feedWarningTime?: string \| number; diaperWarningTime?: string \| number; } \| null` | The currently selected baby | Required |
| `sleepingBabies` | `Set<string>` | Set of baby IDs that are currently sleeping | Required |
| `sleepStartTime` | `Record<string, Date>` | Record of sleep start times by baby ID | Required |
| `lastSleepEndTime` | `Record<string, Date>` | Record of last sleep end times by baby ID | Required |
| `lastFeedTime` | `Record<string, Date>` | Record of last feed times by baby ID | Required |
| `lastDiaperTime` | `Record<string, Date>` | Record of last diaper change times by baby ID | Required |
| `updateUnlockTimer` | `() => void` | Function to update the unlock timer | Required |
| `onSleepClick` | `() => void` | Callback when the sleep button is clicked | Required |
| `onFeedClick` | `() => void` | Callback when the feed button is clicked | Required |
| `onDiaperClick` | `() => void` | Callback when the diaper button is clicked | Required |
| `onNoteClick` | `() => void` | Callback when the note button is clicked | Required |

## Visual Behavior

- Displays a grid of four activity buttons (Sleep, Feed, Diaper, Note)
- Each button shows an appropriate icon and label
- Status bubbles appear above buttons to show time elapsed since last activity
- Sleep button toggles between "Start Sleep" and "End Sleep" based on current state
- All buttons maintain consistent styling with the app's design system

## Configure Menu Accessibility

The "Configure" tile opens a dropdown for toggling tile visibility and reordering tiles. Reordering supports three input methods:

- **Drag and drop** (mouse): each row has a drag handle and HTML5 drag events
- **Touch**: long-press a row (150ms) and drag to a new position
- **Keyboard**: each row has "Move up" and "Move down" controls (chevron icons) next to the drag handle

Keyboard implementation notes:

- The move up/down controls are Radix `DropdownMenuItem`s (role `menuitem`), so they participate in the menu's roving arrow-key focus and are announced by screen readers in menu mode; activation calls `onSelect` with `preventDefault()` so the menu stays open while reordering
- The up item is disabled on the first row and the down item on the last row; Radix exposes `aria-disabled`, skips disabled items in arrow-key navigation, and ignores activation. Disabled styling uses `data-[disabled]` variants (with dark-mode rules in `activity-tile-group.css`) rather than `pointer-events-none`, which would retarget presses to the draggable row
- Each item has a localized `aria-label` (e.g. "Move up Sleep"); decorative icons are `aria-hidden`
- After a reorder the rows re-render (keyed DOM nodes are moved), so focus follows the moved item; a ref-based effect additionally restores focus, moving it to the opposite-direction sibling if the activated item became disabled at a boundary
- Order changes made via the keyboard controls persist through the same debounced save as drag reordering

## Implementation Details

The component uses the `ActivityTile` component from the UI components library to render each activity button. It also uses the `StatusBubble` component to display timing information for each activity.

The component is responsible for:
1. Creating appropriate activity objects for each button
2. Handling click events and forwarding them to parent callbacks
3. Calculating and displaying elapsed time for each activity type
4. Showing warning indicators when time thresholds are exceeded

## Adding New Activity Types

To add a new activity type to the ActivityTileGroup:

1. **Update the component's JSX structure**:
   ```tsx
   // Add a new div for your activity
   <div className="relative">
     <ActivityTile
       activity={/* Create appropriate activity object */}
       title="Your New Activity"
       variant="your-activity-variant"
       isButton={true}
       onClick={() => {
         updateUnlockTimer();
         onYourActivityClick();
       }}
     />
     {/* Add status bubble if needed */}
   </div>
   ```

2. **Add a new prop for the click handler**:
   ```tsx
   interface ActivityTileGroupProps {
     // Existing props...
     onYourActivityClick: () => void;
   }
   ```

3. **Update the parent component** to pass the new handler:
   ```tsx
   <ActivityTileGroup
     // Existing props...
     onYourActivityClick={() => setShowYourActivityModal(true)}
   />
   ```

4. **Add timing state** if your activity needs to track elapsed time:
   ```tsx
   // In the parent component
   const [lastYourActivityTime, setLastYourActivityTime] = useState<Record<string, Date>>({});
   
   // Pass to ActivityTileGroup
   <ActivityTileGroup
     // Existing props...
     lastYourActivityTime={lastYourActivityTime}
   />
   ```

5. **Add status tracking** in the parent's activity refresh function:
   ```tsx
   // Update last activity time
   const lastYourActivity = timelineData.data
     .filter((activity: ActivityType) => /* filter for your activity type */)
     .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())[0];
   
   if (lastYourActivity) {
     setLastYourActivityTime(prev => ({
       ...prev,
       [babyId]: new Date(lastYourActivity.time)
     }));
   }
   ```

## Timezone Handling

The ActivityTileGroup component works with the StatusBubble component to ensure accurate time tracking across different timezones and during Daylight Saving Time (DST) changes:

### DST-Aware Duration Calculation

For each activity type that displays a duration (sleep, feed, diaper):

1. The component passes the actual timestamp (startTime) to the StatusBubble component
2. Instead of pre-calculating durations, it lets the StatusBubble handle the calculation
3. This ensures that DST changes are properly accounted for in all duration displays

### Implementation Details

```tsx
// Example of how sleep status is implemented with DST awareness
<StatusBubble
  status="sleeping"
  className="overflow-visible z-40"
  durationInMinutes={0} // Fallback value
  startTime={sleepStartTime[selectedBaby.id]?.toISOString()}
/>
```

By passing the raw timestamp instead of a pre-calculated duration, the component ensures:
- Accurate time display regardless of timezone changes
- Proper handling of DST transitions
- Consistent user experience when traveling between timezones

## Cross-Platform Considerations

This component is designed with cross-platform compatibility in mind:

- Uses standard React patterns that can be adapted to React Native
- Relies on the `ActivityTile` component which can be implemented for mobile
- Avoids web-specific APIs
- Uses relative sizing that can be adapted to different screen sizes
- Implements touch-friendly button sizes
- Handles timezone differences in a platform-agnostic way

When converting to React Native, the grid layout would need to be implemented using React Native's `View` and `FlatList` components instead of CSS grid. The timezone handling would remain largely the same, as it uses standard JavaScript Date APIs that are available in React Native.
