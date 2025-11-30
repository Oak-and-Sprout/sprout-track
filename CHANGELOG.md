# Sprout Track Changelog

## v0.96.24 - Bug Fixes For Timeilne, Daily Stats and Forms

### Changes

- Updated the timeline to include an "Early Morning" sort area
- Added dates to sleep logs that span over midnight
- Updated the daily stats to include feed unit counts \ time, and added poopy diaper counter
- Updated activity forms so that time did not auto increment on background refreshes overriding user entry

## v0.96.7 - Fixes for Stripe API's

### Changes

- Added safe Stripe handling for self-hosted apps.  The Stripe API's no longer fail during build and are disabled when the app is not in SaaS mode.

## v0.96.0 - Timeline Overhaul V2 & Account Payments

### Changes

#### Timeline Overhaul
- Added a more streamlined version of the timeline
- Made daily summary the filter for activities that exist within the day selected

#### Account Expiration & Payments
- Added functionality for expired accounts to have a soft read-only user experience
- Added in subscription and full license payment management with Stripe
- Overhauled account usage to not affect self hosted versions of the app

## v0.94.95 - Calendar Hotfix for Accounts

### Changes

#### Calendar\Account Auth Failures
- Fixed account authorization failures on the calendar the caused auto log out in the event an account called an api without the proper context

#### Performance Optimizations
- Removed unnecessary calls from the CalendarEventForm
- Fixed an error that gets generated when a user tries to save a calendar event when a new contact created during the event creation or edit

## v0.94.90 - Docker Entrypoint Script Update

### Changes

#### Docker Startup Script
- Updated entry point script to properly seed databases on startup

## v0.94.89 - API Logging, Account Management, and QoL Improvements - October 28, 2025

### Changes

#### Mandatory Admin Password Reset (Docker Environment File Improvements)
- **IMPORTANT - Only For Self Hosting Family's:** When upgrading from v0.94.24 or earlier, admin passwords will be automatically reset to default "admin" for compatibility
- Added automatic admin password reset to default "admin" when importing older database backups
- Implemented modal notification system to inform users when admin password has been reset
- Improved database restore workflow in both Setup Wizard and Family Manager with password reset notifications

#### API Logging System
- Added comprehensive API logging system with dedicated api-logs.db database
- Implemented authentication logging for security auditing
- Added configuration flag to enable/disable logging
- Created documentation for API logging features and usage

#### Account & Subscription Management
- Added account status tracking for trials and subscriptions
- Implemented account expiration handling with automatic logout for expired accounts
- Added subscription type management in database schema
- Enhanced family-manager and account pages to display account status information correctly
- Updated setup wizard to check for deployment mode, beta participation, and plan limits
- Added security checks to prevent brute force login attempts on expired accounts
- Fixed account family context to ensure smooth family setup process

#### Authentication Improvements
- Updated schema to support storing authentication mode at family level
- Added ability to switch between authentication modes (PIN/password)
- Enhanced security login page to work based on family authentication mode
- Updated caretaker API to use sysadmin context properly
- Fixed authentication mode switching to handle sysadmin context and reset stale data
- Updated settings form to group authentication settings with toggle for auth mode

#### User Interface Enhancements
- Added family name and share button to side navigation for easy URL sharing
- Enhanced login component with keyboard input support on desktop devices
- Added visual highlighting for active PIN/password input fields
- Updated share button with toast message notification
- Switched green colors throughout app for better visual consistency
- Removed emojis from interface

#### Activity Tracking Improvements
- Added blowout/leakage flag to diaper tracking model and forms
- Added blowout/leakage indicator to timeline views
- Fixed hardcoded feed amount in stats tab to use dynamic values
- Enhanced time selector to auto-switch between minutes and hours based on input
- Added QoL improvement for AM/PM auto-switching when crossing 12 on time selector

#### System Administration
- Added utility to reset administrator password for family-manager page
- Created documentation for system administrator password reset tool
- Enhanced family upgrade context checks
- Added expired account component to block login for expired accounts

#### Bug Fixes & Technical Improvements
- Made .env files persistent in docker images
- Updated backup\restore functioanlity to include environment files in with the database backup (now in a zip file)
- Removed timeline console logging that was accidently left on for debugging
- Added generic units to database seeds
- Updated formatting for drops unit display
- Fixed tab functionality to properly populate family slug
- Fixed type errors in account expiration handling
- Updated API to allow expired accounts with valid JWTs limited access
- Added migration to nullify authType system defaults from previous versions
- Adjusted caretaker counting logic to account for single '00' system caretaker
- Fixed account expiration status appearing incorrectly on family login page
- Added documentation on expiration validation logic

---

## v0.94.24 - Breastfeed Timer Patch - August, 24 2025

### Changes

#### Breastfeed Timer Fixes
- Broke out the timer into seperate component to make more modular and easier to service
- Fixed logic on touch or click to clear placeholder 00 and allow two digit input in all scenarios

---

## v0.94.22 - QoL, Enhancemens, Bugfixes - August, 13 2025

### Changes

#### QoL, Enhancements, Bugfixes
- Updated log entry timeline to have an actual timeline
- Removed indigo colors around input forms, text areas, drop downs, and other components to match the rest of the app
- Added the ability to select the month and year from the calendar widget
- Fixed the time select widget so that if on mobile and drag the time bubble down the web browser doesn't refresh
- Fixed the calnedar page on mobile so it properly renders to device height
- Fixed the medicine form tabs to match the new form-page tab arcitecture
- Fixed the medicine forms to properly allow for decimal points in the dose entry

#### SaaS Updates
- Fixed spelling for spourt-256.png -> sprout-256.png and fixed references
- Replaced coming-soon with home and removed sphome \ fixed references in app to the new home location in SaaS mode
- SEO updates for home page
- Fixed registration and login modal sizes for mobile screens when they extend past max screen size
---

## v0.94.11 - Feedback Additions and Family Manager Enhancements\Refactor

### Changes

#### Account Management
- Added the ability for accounts and users to provide feedback when the app is in saas mode
- Added account and feedback management into the family-manager screen
- Refactored family-manager page to use deployment context and componentize tabs

---

## v0.94.8 - Live Beta Edition, Bugfixes, Enhancements

### Changes

#### Account Management
- In the account-button we added the ability to manage accounts.  Users can now do the following:
  - Manage the account (name, email address, password), family settings (name and slug), download their family data, and delete their account
  - Manage babies, caretakers, and contacts
- Added flair for beta users because you are special and we care about you

#### Bugfixes and Enhancements
- Cleaned up the breast feed forms to have new side by side timers
- Timers are directly editable now without pressing the "edit" button
- Timers now have more visual indication that the timer is running for a specific side
- Cleaned up the breast feed edit forms to represent the side you are editing for (right versus left)
- Fixed a bug where timers "pause" when leaving the browser tab or the phone is locked
- Overhauled URL slug validation to create system reserved list

---

## v0.94.0 - Live Beta Edition

### Changes

#### Beta Functionality
- Added ability for SaaS version to have accounts, link accounts to new families, and a caretaker that allows pass-through permissions
- Added account workflow for SaaS mode
- Removed access to certain screens and settings in SaaS mode
- Added complete account management workflow, account verification, password resets
- Overhauled email communications
- Added Sprout Track terms and privacy policy

#### Demo Enhancements
- Added new demo scripts to overhaul the demo to be more realistic
- Added functionality to clean up demo data every hour
- Streamlined the demo in the app so it is single tenant instead of needing multiple apps running for the demo environment

#### Bug Fixes
- Added deployment context to minimize API calls
- Calendar fixes for baby context
- Added a close button to the calendar day view
- Adjusted calendar event form to provide enough space at the bottom of the form
- Bug fixes to API handling of permissions in elevated contexts for accounts and admins

---

## v0.92.32 - Beta Subscriber Management & Email Integration

### Changes

- Added a new "Beta Subscribers" tab to the Family Manager page for viewing and managing beta subscribers, visible only in SaaS deployment mode.
- Created a new API route for fetching, updating, and deleting beta subscribers.
- Added the ability to opt-out and delete beta subscribers from the Family Manager page.
- Improved the empty table message for beta subscribers to be more descriptive.
- Added email integrations for manual SMTP setup, SMTP2GO, and SendGrid.
- Added email test scripts.
- Added server configuration to application config settings pages.

---

## v0.92.19 - Calendar Bugfixes and Small Enhancements - July 2025

### Changes

- Updated the main calendar view and calendar day view to ensure events are displayed based on the user's timezone rather than the server timezone
- Replaced event dots with event titles in the main calendar view to make the calendar more readable
- Fixed an issue where the calendar event form would not reset properly when adding multiple events for the same day in succession

---

## v0.92.16 - Bugfixes - July 2025

### Changes

- Updated Calendar view page to use this months date instead of hardcoding April 2025 on page load
- Fixed issue in Log-Entry timeline view so that it pulls records in users timezone and not server timezone
- Refactored status bubbles to work better with mobile and tablet browsers

---

## v0.92.13 - Critical fix for token setup - July 2025

### Changes

- Bugfix for caretakers not being associated to families properly
- Bugfix for system account context for family not working correctly during setup (user would get error during setup)

---

## v0.92.11 - Multi-family Edition Enhancements and Bugfixs - July 2025

### Changes

#### Enhancements and Bugfixes
- Fixed sysadmin level authentication for the session and timezone debug tools
- Fixed sysadmin level authenciation for settings and baby API's in settings forms and setup pages
- Fixed bugs where duplicate medicines would get generated when editing a medicine dose from the timeline
- Enhanced the Medicine activities to streamline giving doses with active doses, removing an uneccessary tab
- Streamlined the Medicine form so the user does not have to enter DD:HH:MM for the minimum dose time
- Added correct light\dark mode theming to the Medicine activity forms
- Fixes for docker builds with enviornment files in both arm64 and x64 architectures
- Fixed local env file generation when building the app for the first time
- Fixed styling for calendar components in baby form and setup forms so that they do not look disabled
- Added new select baby pages when a user logs in with multiple babies tied to the family
- **Security Fix** Fixed the Docker build process to not generate the hash until the container starts of when the image is built

---

## v0.92.0 - Multi-family Edition - July 2025

### Changes

#### Multi-family Support
- Added family-level access by link/slug for independent family management
- Overhauled data schema to support multiple families with isolated data
- Updated all API endpoints to use family context for secure data access
- Updated authentication system with family-level users, admin roles, and global system administrator role
- Added ability for system administrators to manage existing families, invite new families (by link), and manually add new families
- Overhauled settings and forms for family-specific configuration
- Updated database migration scripts, including family migration script for existing databases
- Updated login screens with family information and URL sharing capabilities

#### Authentication & Security Enhancements
- Added system caretaker security lockout - system accounts (loginId '00') are automatically disabled when regular caretakers exist for a family
- Implemented on-demand creation of system caretakers and settings for families without configured users
- Added JWT-based authentication with family context embedded in tokens
- Enhanced admin authentication to support family-level, system caretaker, and global system administrator access

#### User Interface Improvements
- Updated login screens to display family information and support URL sharing
- Added family selection interface for users with access to multiple families
- Improved family management interface for system administrators
- Enhanced forms and settings pages for family-specific configuration

#### Backup and Restore Enhancements
- Added automatic post-restore database migration system to ensure compatibility with older backup versions
- Implemented initial setup database import capability - users can now import existing data during setup wizard
- Added real-time migration progress indicators with detailed step-by-step feedback
- Enhanced error handling for migration failures, authentication issues, and database compatibility problems

#### Other Fixes and Improvements
- Updated API calls to provide more real-time feel while minimizing bandwidth when app not actively used
- Fixed time that loads when opening most activities to be now instead of the the of the last page refresh
- Updated pump log so end time is now and start time defaults to 15 minutes in the past
- Removed solid foods from feed timer calculations
- Updated activity timeline descriptions to show units correctly
- Fixed visual bugs for light/dark mode consistency
- Improved error handling and user feedback across the application
- Fixed the caretaker form so that users can only correctly enter in numbers instead of characters

---

## v0.91.4 - Added Medicine Tracker - (Beta) - April 2025

### Changes

#### Fixes and Improvements

- Removed duplicate scripts directory (thanks, [@need4swede](https://github.com/need4swede))
- Added fixes so that new activities show up if config doesn't exist
- Updated the prisma/seed.ts script to add units for medicines and update units with activity groups when they do not exist
- Updated the scripts/update.sh script to add seed step after migrations

#### Medicine Tracker
- Added ability to add medicines and link contacts to medicines
- Ability to track the dose given
- Ability to see doses, and when a new dose is safe to administer
- Added medicine tracking to log-entry and full-log views

---

## v0.9.3 (Beta Patch) - April 2025

### Changes

  - Fixed an issue where etc/timezones isn't available in docker images
  - Added the ability to set cookie auth to require HTTPS or not.  This is added to the .env file.  When enabled the cookie will only be valid and sent when the app is accessed over HTTPS.  When set to false the cookie will be valid and sent over HTTP or HTTPS.  IMPORTANT: When setting this to true you must have an SSL certificate in place otherwise all main API's will be blocked.
  - Added the ability to disable Next.js telemetry collection in the setup scripts

---

## v0.9.0 (Beta Release) - April 2025

The beta release of Sprout Track as a self-hostable baby tracking application.

### Features

#### Activity Tracking
  - Sleep logs
  - Feed logs (bottle and solids)
  - Diaper logs
  - Bath logs
  - Notes
  - Measurements
  - Milestones

#### Reporting & Analysis
  - High-level reporting and statistics
  - Full log with date range filtering
  - Quick search functionality for specific items

#### Multi-user Support
  - Multiple caretaker accounts
  - Role-based permissions

#### Calendar & Planning
  - Calendar events for caretaker schedules
  - Appointment reminders
  - Custom event creation

### Technical Details

- Built with Next.js (App Router)
- TypeScript for type safety
- Prisma with SQLite database
- TailwindCSS for styling
- Responsive design for mobile and desktop use
- Dark mode support
