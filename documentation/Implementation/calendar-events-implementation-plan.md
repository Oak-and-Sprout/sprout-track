# Calendar Events Implementation Plan

This document outlines the comprehensive plan for implementing calendar events functionality in the Baby Tracker application.

## 1. Schema Updates

We'll update the Prisma schema to support calendar events with the following models:

```prisma
// New model for contacts (doctors, teachers, etc.)
model Contact {
  id          String    @id @default(uuid())
  name        String
  role        String    // doctor, teacher, family member, etc.
  phone       String?
  email       String?
  address     String?
  notes       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?
  
  // Relationships
  events      CalendarEvent[] // Events associated with this contact
  
  @@index([role])
  @@index([deletedAt])
}

// New enum for calendar event types
enum CalendarEventType {
  APPOINTMENT
  CARETAKER_SCHEDULE
  REMINDER
  CUSTOM
}

// New enum for recurrence patterns
enum RecurrencePattern {
  DAILY
  WEEKLY
  BIWEEKLY
  MONTHLY
  YEARLY
  CUSTOM
}

// New model for calendar events
model CalendarEvent {
  id                String           @id @default(uuid())
  title             String
  description       String?
  startTime         DateTime
  endTime           DateTime?
  allDay            Boolean          @default(false)
  type              CalendarEventType
  location          String?
  color             String?          // For custom color coding
  
  // Recurrence fields
  recurring         Boolean          @default(false)
  recurrencePattern RecurrencePattern? 
  recurrenceEnd     DateTime?        // When the recurrence ends
  customRecurrence  String?          // JSON string for custom recurrence rules
  
  // Notification fields
  reminderTime      Int?             // Minutes before event to send reminder
  notificationSent  Boolean          @default(false)
  
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  deletedAt         DateTime?
  
  // Relationships - multiple babies and caretakers can be associated with an event
  babies            BabyEvent[]
  caretakers        CaretakerEvent[]
  contacts          ContactEvent[]   // Many-to-many with contacts
  
  @@index([startTime])
  @@index([endTime])
  @@index([type])
  @@index([recurring])
  @@index([deletedAt])
}

// Junction table for many-to-many relationship between babies and events
model BabyEvent {
  baby        Baby          @relation(fields: [babyId], references: [id], onDelete: Cascade)
  babyId      String
  event       CalendarEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  eventId     String
  
  @@id([babyId, eventId])
  @@index([babyId])
  @@index([eventId])
}

// Junction table for many-to-many relationship between caretakers and events
model CaretakerEvent {
  caretaker   Caretaker     @relation(fields: [caretakerId], references: [id], onDelete: Cascade)
  caretakerId String
  event       CalendarEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  eventId     String
  
  @@id([caretakerId, eventId])
  @@index([caretakerId])
  @@index([eventId])
}

// Junction table for many-to-many relationship between contacts and events
model ContactEvent {
  contact     Contact       @relation(fields: [contactId], references: [id], onDelete: Cascade)
  contactId   String
  event       CalendarEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  eventId     String
  
  @@id([contactId, eventId])
  @@index([contactId])
  @@index([eventId])
}
```

This schema provides:
- Support for contacts (doctors, teachers, etc.)
- Many-to-many relationships between events and babies/caretakers/contacts
- Structured recurrence patterns with custom options
- Notification/reminder capabilities
- Color coding for visual differentiation

## 2. Component Structure

Following the project's component structure pattern, we'll create the following components:

### A. Calendar Event Components

```
src/components/CalendarEvent/
├── index.tsx                    # Main component export
├── calendar-event.css           # Component-specific CSS
├── calendar-event.styles.ts     # Tailwind styles
├── calendar-event.types.ts      # TypeScript types
└── README.md                    # Documentation
```

### B. Calendar Event Item Component

```
src/components/CalendarEventItem/
├── index.tsx                    # Main component export
├── calendar-event-item.css      # Component-specific CSS
├── calendar-event-item.styles.ts # Tailwind styles
├── calendar-event-item.types.ts # TypeScript types
└── README.md                    # Documentation
```

### C. Calendar Event Form Component

```
src/components/forms/CalendarEventForm/
├── index.tsx                    # Main component export
├── calendar-event-form.css      # Component-specific CSS
├── calendar-event-form.styles.ts # Tailwind styles
├── calendar-event-form.types.ts # TypeScript types
├── RecurrenceSelector.tsx       # Sub-component for recurrence options
├── ContactSelector.tsx          # Sub-component for contact selection
└── README.md                    # Documentation
```

### D. Calendar Day View Component

```
src/components/CalendarDayView/
├── index.tsx                    # Main component export
├── calendar-day-view.css        # Component-specific CSS
├── calendar-day-view.styles.ts  # Tailwind styles
├── calendar-day-view.types.ts   # TypeScript types
└── README.md                    # Documentation
```

### E. Caretaker Schedule Component

```
src/components/CaretakerSchedule/
├── index.tsx                    # Main component export
├── caretaker-schedule.css       # Component-specific CSS
├── caretaker-schedule.styles.ts # Tailwind styles
├── caretaker-schedule.types.ts  # TypeScript types
└── README.md                    # Documentation
```

### F. Notification Components

```
src/components/EventNotification/
├── index.tsx                    # Main component export
├── event-notification.css       # Component-specific CSS
├── event-notification.styles.ts # Tailwind styles
├── event-notification.types.ts  # TypeScript types
├── NotificationToast.tsx        # Toast notification component
└── README.md                    # Documentation
```

## 3. API Implementation

We'll create comprehensive API routes for calendar events:

```
app/api/calendar-event/
├── route.ts                     # Main CRUD operations
├── recurring/
│   └── route.ts                 # Handle recurring event instances
├── notification/
│   └── route.ts                 # Handle notifications and reminders
└── search/
    └── route.ts                 # Advanced search and filtering
```

For contacts:

```
app/api/contact/
└── route.ts                     # CRUD operations for contacts
```

## 4. User Flows

### Main Calendar Flow

1. User views the calendar and sees days with events indicated
2. User selects a date to view events for that day
3. A list of events appears below the calendar
4. User can click "Add Event" to create a new event
5. When clicking on an existing event, a FormPage opens with event details
6. User can edit or delete the event from this detail view

### Caretaker Schedule Flow

1. User navigates to a dedicated "Caretaker Schedule" view
2. This view shows a simplified calendar focused on caretaker assignments
3. User can quickly add/edit caretaker schedules
4. The interface is optimized for scheduling (e.g., drag-and-drop time blocks)

### Notification Flow

1. When a user logs in, the system checks for upcoming events
2. If events are found within the reminder window, a toast notification appears
3. The BabyQuickStats component will show upcoming events at the top
4. Clicking on a notification takes the user to the event details

## 5. UI Components in Detail

### CalendarEventItem

This component will display a single calendar event in a list view:

```tsx
<CalendarEventItem
  event={event}
  onClick={() => openEventDetails(event.id)}
/>
```

Features:
- Color-coded left border based on event type
- Icon representing event type
- Title, time, and brief description
- Visual indicator for recurring events
- Badges showing associated babies/caretakers

### CalendarEventForm

This form will handle creating and editing events:

```tsx
<CalendarEventForm
  isOpen={showEventForm}
  onClose={() => setShowEventForm(false)}
  event={selectedEvent} // Optional - for editing
  onSave={handleSaveEvent}
  babies={babies}
  caretakers={caretakers}
  contacts={contacts}
/>
```

Features:
- Fields for all event properties
- Multi-select for babies and caretakers
- Contact selection with ability to create new contacts
- Recurrence pattern selection with custom options
- Reminder/notification settings
- Color selection

### CalendarDayView

This component will display all events for a selected day:

```tsx
<CalendarDayView
  date={selectedDate}
  events={eventsForSelectedDate}
  onEventClick={handleEventClick}
  onAddEvent={handleAddEvent}
/>
```

Features:
- Chronological list of events for the day
- Time-based grouping (morning, afternoon, evening)
- Visual distinction between different event types
- "Add Event" button

### EventNotification

This component will handle displaying notifications:

```tsx
<EventNotification
  event={upcomingEvent}
  onView={() => navigateToEvent(upcomingEvent.id)}
  onDismiss={() => dismissNotification(upcomingEvent.id)}
/>
```

Features:
- Toast notification for upcoming events
- Summary of event details
- Action buttons (view, dismiss)

## 6. BabyQuickStats Integration

We'll update the BabyQuickStats component to include upcoming events:

```tsx
<section className="upcoming-events">
  <h3>Upcoming Events</h3>
  {upcomingEvents.length > 0 ? (
    <div className="event-list">
      {upcomingEvents.map(event => (
        <CalendarEventItem
          key={event.id}
          event={event}
          compact={true}
          onClick={() => openEventDetails(event.id)}
        />
      ))}
    </div>
  ) : (
    <p>No upcoming events</p>
  )}
</section>
```

## 7. Implementation Phases

### Phase 1: Foundation
1. Update Prisma schema
2. Create migration
3. Implement basic API endpoints
4. Create core UI components (CalendarEventItem, CalendarEventForm)

### Phase 2: Calendar Integration
1. Update Calendar component to show event indicators
2. Implement CalendarDayView component
3. Connect calendar selection to event display

### Phase 3: Advanced Features
1. Implement recurring events logic
2. Create notification system
3. Build caretaker schedule view
4. Integrate with BabyQuickStats

### Phase 4: Polish and Optimization
1. Add animations and transitions
2. Optimize performance for mobile
3. Implement offline support
4. Add comprehensive error handling

## 8. Technical Considerations

### Recurring Events

For recurring events, we'll need to:
1. Store the base event with recurrence pattern
2. Generate occurrences on-the-fly when fetching events
3. Handle exceptions (modified or deleted occurrences)

### Notifications

For notifications, we'll implement:
1. A background check for upcoming events when the app loads
2. A toast notification system for displaying alerts
3. Integration with the BabyQuickStats component

### Mobile Considerations

Since this is a mobile-first app:
1. Ensure all components are touch-friendly
2. Optimize forms for small screens
3. Use responsive design throughout
4. Consider offline capabilities

## UI Mockups

### Calendar View with Events
```
┌─────────────────────────────────────┐
│           Calendar View             │
│                                     │
│  ┌───┬───┬───┬───┬───┬───┬───┐     │
│  │ S │ M │ T │ W │ T │ F │ S │     │
│  ├───┼───┼───┼───┼───┼───┼───┤     │
│  │   │   │   │   │   │   │   │     │
│  ├───┼───┼───┼───┼───┼───┼───┤     │
│  │   │   │ • │   │   │ • │   │     │ ← Days with events have indicators
│  ├───┼───┼───┼───┼───┼───┼───┤     │
│  │   │   │   │   │   │   │   │     │
│  └───┴───┴───┴───┴───┴───┴───┘     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Events for March 15, 2025   │    │ ← Selected day events
│  │                             │    │
│  │ ┌─────────────────────────┐ │    │
│  │ │ Doctor Appointment      │ │    │ ← CalendarEventItem
│  │ │ 10:00 AM - 11:00 AM     │ │    │
│  │ └─────────────────────────┘ │    │
│  │                             │    │
│  │ ┌─────────────────────────┐ │    │
│  │ │ Nanny Schedule          │ │    │
│  │ │ 1:00 PM - 5:00 PM       │ │    │
│  │ └─────────────────────────┘ │    │
│  │                             │    │
│  │ ┌─────────────────────────┐ │    │
│  │ │ + Add Event             │ │    │
│  │ └─────────────────────────┘ │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Event Detail View
```
┌─────────────────────────────────────┐ ┌─────────────────────────────┐
│           Calendar View             │ │ Doctor Appointment          │
│                                     │ │                             │
│  ┌───┬───┬───┬───┬───┬───┬───┐     │ │ Time: 10:00 AM - 11:00 AM   │
│  │ S │ M │ T │ W │ T │ F │ S │     │ │ Location: Pediatric Clinic  │
│  ├───┼───┼───┼───┼───┼───┼───┤     │ │                             │
│  │   │   │   │   │   │   │   │     │ │ Description:                │
│  ├───┼───┼───┼───┼───┼───┼───┤     │ │ Regular checkup with        │
│  │   │   │ • │   │   │ • │   │     │ │ Dr. Smith                   │
│  ├───┼───┼───┼───┼───┼───┼───┤     │ │                             │
│  │   │   │   │   │   │   │   │     │ │ Babies:                     │
│  └───┴───┴───┴───┴───┴───┴───┘     │ │ Emma, Noah                  │
│                                     │ │                             │
│  ┌─────────────────────────────┐    │ │ Caretakers:                │
│  │ Events for March 15, 2025   │    │ │ Mom, Dad                   │
│  │                             │    │ │                             │
│  │ ┌─────────────────────────┐ │    │ │ Contact:                   │
│  │ │ Doctor Appointment      │ │    │ │ Dr. Smith                  │
│  │ │ 10:00 AM - 11:00 AM     │ │    │ │                             │
│  │ └─────────────────────────┘ │    │ │ Reminder: 30 minutes before │
│  │                             │    │ │                             │
│  │ ┌─────────────────────────┐ │    │ │                             │
│  │ │ Nanny Schedule          │ │    │ │                             │
│  │ │ 1:00 PM - 5:00 PM       │ │    │ │                             │
│  │ └─────────────────────────┘ │    │ │ [Edit]        [Delete]      │
│  └─────────────────────────────┘    │ └─────────────────────────────┘
└─────────────────────────────────────┘
```

### Caretaker Schedule View
```
┌─────────────────────────────────────┐
│        Caretaker Schedule           │
│                                     │
│  ┌───┬───┬───┬───┬───┬───┬───┐     │
│  │ S │ M │ T │ W │ T │ F │ S │     │
│  ├───┼───┼───┼───┼───┼───┼───┤     │
│  │   │   │   │   │   │   │   │     │
│  ├───┼───┼───┼───┼───┼───┼───┤     │
│  │   │   │   │   │   │   │   │     │
│  ├───┼───┼───┼───┼───┼───┼───┤     │
│  │   │   │   │   │   │   │   │     │
│  └───┴───┴───┴───┴───┴───┴───┘     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Caretakers for March 15     │    │
│  │                             │    │
│  │ ┌─────────────────────────┐ │    │
│  │ │ Mom                     │ │    │
│  │ │ 8:00 AM - 1:00 PM       │ │    │
│  │ └─────────────────────────┘ │    │
│  │                             │    │
│  │ ┌─────────────────────────┐ │    │
│  │ │ Nanny                   │ │    │
│  │ │ 1:00 PM - 5:00 PM       │ │    │
│  │ └─────────────────────────┘ │    │
│  │                             │    │
│  │ ┌─────────────────────────┐ │    │
│  │ │ Dad                     │ │    │
│  │ │ 5:00 PM - 10:00 PM      │ │    │
│  │ └─────────────────────────┘ │    │
│  │                             │    │
│  │ ┌─────────────────────────┐ │    │
│  │ │ + Add Caretaker Shift   │ │    │
│  │ └─────────────────────────┘ │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Notification in BabyQuickStats
```
┌─────────────────────────────────────┐
│         Baby Quick Stats            │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Upcoming Events             │    │
│  │                             │    │
│  │ ┌─────────────────────────┐ │    │
│  │ │ Doctor Appointment      │ │    │
│  │ │ Today, 10:00 AM         │ │    │
│  │ └─────────────────────────┘ │    │
│  │                             │    │
│  │ ┌─────────────────────────┐ │    │
│  │ │ Nanny Schedule          │ │    │
│  │ │ Today, 1:00 PM          │ │    │
│  │ └─────────────────────────┘ │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Sleep Stats                 │    │
│  │ ...                         │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
