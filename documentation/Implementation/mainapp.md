Create a modern baby tracking application using Next.js, Tailwind CSS, and Prisma with SQLite. The application should be fully responsive and optimize space usage for both mobile and desktop views.

Technical Requirements:
1. Use Next.js App Router structure /app
2. Implement API routes in the /app/api folder for all baby-related functions
3. Use Prisma with SQLite for data management /prisma and /db
4. Implement Tailwind CSS for styling
5. Use shadcn/ui components for UI elements
6. Use Lucide icons for all iconography
7. Any new libraries we use should be installed first so the latest version is added to package.json

Core Features:

1. Baby Management:
   - Selector dropdown in the top bar for choosing active baby
   - Edit and Add buttons that trigger modals
   - Form fields: First Name, Last Name, Birth Date, Gender
   - Store data using API route: /app/api/baby

2. Activity Tracking:
   Quick action buttons for:
   - Sleep tracking (start/stop with mood and notes)
   - Bottle feeding
   - Diaper changes
   - Manual entry for historical data
   Store data using respective API routes:
   - /app/api/sleep
   - /app/api/feed
   - /app/api/diaper
   - /app/api/note

3. Recent Activity Timeline:
   - Chronological list of all activities
   - Each entry shows:
     * Activity type icon
     * Activity description
     * Timestamp/duration
     * Options menu for edit/delete
   - Fetch data using: /app/api/activity

Layout Requirements:

1. Mobile View (< 768px):
   - Full-width components
   - Single column quick action buttons
   - Condensed timeline entries
   - Bottom navigation bar for key actions
   - Modal dialogs should use full width with appropriate padding

2. Tablet View (768px - 1024px):
   - Two-column quick action buttons
   - Sidebar navigation
   - Larger touch targets
   - Modals should be centered with max-width

3. Desktop View (> 1024px):
   - Maximum width of 4xl (56rem)
   - Four-column quick action buttons
   - Expanded timeline view
   - Efficient use of horizontal space

Modal Requirements:

1. Baby Add/Edit Modal:
   - Form validation
   - Save/Cancel buttons
   - Close on outside click
   - Proper error handling

2. Sleep Modal:
   - Start/End time selection
   - Mood selector
   - Notes field
   - Location field (optional)

3. Feeding Modal:
   - Time selection
   - Amount input
   - Type selector (breast, bottle, solids)
   - Side selection for breastfeeding
   - Notes field

4. Diaper Modal:
   - Time selection
   - Type selector (wet, dirty, both)
   - Condition notes
   - Color selection

5. Manual Entry Modal:
   - Activity type selector
   - Custom time selection
   - Activity-specific fields
   - Notes field

State Management:
- Use React's useState for component-level state
- Implement proper loading states
- Handle error states gracefully
- Show appropriate feedback for user actions

Additional Features to Consider:
1. Statistics dashboard
2. Growth tracking
3. Multiple caregiver support
4. Data export functionality
5. Photo gallery for milestones
6. Reminder system

Error Handling:
- Implement proper error boundaries
- Show user-friendly error messages
- Provide fallback UI for loading states
- Handle offline capabilities

Security Considerations:
1. Input sanitization
2. Data validation
3. API route protection
4. User authentication (if implementing multiple caregivers)

Use the provided sample code as a starting point, but ensure the final implementation:
1. Properly handles all viewport sizes
2. Implements proper error handling
3. Uses appropriate loading states
4. Follows accessibility guidelines
5. Implements proper form validation
6. Uses consistent styling throughout
7. Optimizes performance

The final application should provide a seamless experience across all devices while maintaining a clean, modern aesthetic that's easy for tired parents to use.