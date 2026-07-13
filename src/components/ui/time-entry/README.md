# TimeEntry Component

A clock wheel interface for time selection with an intuitive UI similar to mobile time pickers.

## Features

- Interactive clock face for selecting hours and minutes
- Visual clock hand that rotates to show the selected time
- Emerald green header with large time display
- AM/PM toggle buttons
- Mode switching between hours and minutes
- Minute markers with 5-minute increments and tick marks for individual minutes
- Smooth animations for value changes
- Responsive design for mobile and desktop
- Dark mode support
- Keyboard-accessible hour/minute spinbuttons in the header (typed digits, Arrow Up/Down with wrapping, Home/End)

## Usage

```tsx
import { TimeEntry } from '@/src/components/ui/time-entry';
import { useState } from 'react';

function TimeEntryExample() {
  const [selectedTime, setSelectedTime] = useState(new Date());
  
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-2">Select Time</h2>
      <TimeEntry 
        value={selectedTime} 
        onChange={setSelectedTime}
      />
    </div>
  );
}
```

## Component API

### TimeEntry

Main component for time selection with a clock wheel interface.

#### Props

| Prop | Type | Description | Default |
|------|------|-------------|---------|
| `value` | `Date` | The currently selected time | Required |
| `onChange` | `(date: Date) => void` | Callback function when time changes | Required |
| `className` | `string \| undefined` | Optional class name for additional styling | `undefined` |
| `disabled` | `boolean` | Whether the component is disabled | `false` |
| `minTime` | `Date \| undefined` | Optional minimum time allowed | `undefined` |
| `maxTime` | `Date \| undefined` | Optional maximum time allowed | `undefined` |

## Visual Behavior

- Displays an emerald green header with the current time in large text
- Shows AM/PM toggle buttons in the header
- Presents a clock face with hour markers (1-12)
- Highlights the currently selected hour or minute
- Shows a clock hand pointing to the selected value
- Automatically switches from hours to minutes mode after selecting an hour

## Implementation Details

The component handles:
- Click interactions on the clock face to select hours and minutes
- Proper time calculations with AM/PM conversion
- Validation against min/max time constraints
- Smooth animations for clock hand rotation

## Accessibility

- The hour and minute values in the header are text inputs exposed as `role="spinbutton"` with `aria-valuemin`/`aria-valuemax`/`aria-valuenow` and localized `aria-label`s (`Hours`/`Minutes`). They support typing digits (clamped to the valid range), Arrow Up/Down to step with wrapping at the bounds, and Home/End to jump to the bounds. Focusing an input also switches the dial's mode, matching the old click behavior.
- The AM/PM toggles are native `<button type="button">` elements with `aria-pressed`.
- The analog clock face is `aria-hidden` — it remains fully pointer/touch interactive, while the header spinbuttons are the non-visual (screen reader / keyboard) path for setting the time.

## Cross-Platform Considerations

This component is designed with cross-platform compatibility in mind:

- Uses standard React patterns that can be adapted to React Native
- Implements touch interactions that work on both mobile and desktop
- Uses relative sizing that can be adapted to different screen sizes
- Handles time in a platform-agnostic way

When converting to React Native, the clock face would need to be implemented using React Native's `View` components and gesture system, but the overall structure and logic would remain similar.
