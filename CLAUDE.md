# Next.js Development Rules

These rules define the development patterns, conventions, and architecture for Sprout Track. This document serves as the primary context for AI-assisted development sessions.

## Tech Stack

- Next.js with App Router: Core framework for routing, server components, and API routes.
- TypeScript: For type-safe code.
- Prisma with SQLite: The ORM and database for data persistence.
- TailwindCSS: For utility-first styling (no CSS Modules, no Styled Components).
- React Hooks (useState, useEffect, useContext): Used for all client-side state management, data fetching, and form handling.
- PWA architecture with offline support, push notifications (VAPID), and Wake Lock API.

## Project Structure

- Follow the `/src` directory structure with dedicated folders for components, hooks, services, utils, constants, context, types, and styles
- Component organization under `src/components/`:
  - `ui/` — base UI primitives (button, input, etc.), each with their own folder containing `index.tsx`, `styles.ts`, `types.ts`, `.css`, and `README.md`
  - `forms/` — form components built on top of `ui/` form page components
  - `modals/` — modal components
  - Feature components live in their own named folders at the component root (e.g., `Calendar/`, `Timeline/`, `Reports/`, `DailyStats/`, `BabySelector/`, `SetupWizard/`) — there is no `features/` directory
  - Domain management components: `account-manager/`, `familymanager/`
- Keep component files, styles, types, and documentation together in the same folder
- Include README.md files for components documenting props, usage, and implementation details
- Maintain a consistent naming convention across all files and components
- Backend API layers are fully separated from the Next.js web layer

## Component Architecture

- Create “dumb” UI components that are highly configurable through props
- Implement container/presentational pattern to separate data fetching from UI rendering
- Keep components small and focused (under 200 lines of code)
- Use composition over inheritance when building complex components
- Include props for error and loading states in all data-dependent components
- Design with accessibility in mind from the start (proper ARIA attributes)
- Document component APIs thoroughly in component README files

## TypeScript Implementation

- Enable strict TypeScript mode in `tsconfig.json`
- Create shared types in the `/types` directory for domain entities
- Use discriminated unions for different event types (e.g., feeding vs. diaper events)
- Implement type guards for safe type narrowing
- Define constants with type safety using `as const` assertions
- Create specific error types that extend the base Error class
- Use TypeScript generics for reusable components and functions
- Define readonly properties for immutable data

## State Management

- Implement custom hooks for complex state logic
- Create context providers for global state that needs to be accessed by multiple components
- Use `useEffect` for data fetching with proper loading and error state handling — React Query is not used in this project
- Follow immutable update patterns in all state modifications
- Implement memoization for expensive computations with useMemo
- Include proper error and loading states in all async operations
- Design state management with offline-first principles

## Styling Approach

- Do not use CSS Modules (`.module.css`), Styled Components, or inline style objects
- Components use Class Variance Authority (CVA) for variant management
- Each component follows a modular file structure:
  - `index.tsx` — component implementation
  - `[component].styles.ts` — CVA style definitions with Tailwind classes for light mode variants
  - `[component].css` — plain CSS file with `html.dark` selectors for dark mode overrides using custom class names (e.g., `.button-dark-outline`, `.button-dark-ghost`)
  - `[component].types.ts` — TypeScript type definitions
- **Dark mode uses `html.dark` CSS selectors in plain `.css` files, not Tailwind `dark:` classes.** This is intentional — Tailwind’s `dark:` classes respond to system preferences, which bypasses the in-app theme toggle. The `html.dark` class is controlled by the app’s theme context so the toggle works correctly regardless of system settings. Do not use `dark:` prefixed Tailwind classes.
- Light mode = Tailwind utilities via CVA in `styles.ts`. Dark mode = `html.dark .class-name` overrides in `[component].css`. Both are applied to the component together.
- Define a shared design system with consistent variables for colors, spacing, and typography
- Keep styles modular and component-specific using Tailwind utility classes
- Implement responsive design using Tailwind breakpoints
- Export theme tokens as TypeScript constants
- Create helper functions for complex style logic when Tailwind alone is insufficient

## Navigation

- Use Next.js’s file-system based routing
- Define strongly typed route parameters with TypeScript interfaces
- Create navigation utilities that consolidate route definitions
- Implement type-safe navigation helpers
- Create guards for protected routes in middleware
- Make routes accessible and SEO-friendly

## API and Data Fetching

- Create a type-safe fetch wrapper with proper error handling
- Implement domain-specific API services that use the core API layer
- Use `useEffect` with fetch for data loading — React Query is not used
- Implement error handling that provides clear user feedback
- Define optimistic updates for better UX where appropriate
- Structure API responses with consistent types
- Offline capabilities are supported through the PWA service worker
- All API responses follow a consistent format: `{ success: boolean, data?: T, error?: string }`

## Authentication and Authorization

### Overview

- JWT-based auth with tokens stored in `localStorage` as `authToken`
- All API requests include the token via `Authorization: Bearer <token>` header
- Auth utilities are centralized in `/app/api/utils/auth.ts` — do not implement custom auth checks
- Two auth levels: regular users and admins (plus system administrators with `isSysAdmin: true`)

### Auth middleware — use the right wrapper for every API route

- `withAuth(handler)` — any authenticated user can access
- `withAdminAuth(handler)` — admin users, system caretakers (loginId ‘00’), and system administrators only
- `withAuthContext(handler)` — provides `authContext` object with `caretakerId`, `caretakerType`, `caretakerRole`, `familyId`, `familySlug`

```typescript
import { withAuthContext, ApiResponse, AuthResult } from '../utils/auth';

async function handler(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<any>>> {
  const { familyId: userFamilyId } = authContext;
  // ...
}

export const GET = withAuthContext(handler);
```

### Family-level authorization — the golden rule

**Never trust client-sent family context.** The only source of truth for a user’s family is `authContext.familyId` from the middleware. All data access must be scoped to this value.

- **Read/Update/Delete by ID**: Fetch the resource first, verify `resource.familyId === userFamilyId` before proceeding. Return 404 if mismatch.
- **Create**: Verify the parent resource (e.g., baby) belongs to `userFamilyId` before creating. Explicitly set `familyId: userFamilyId` on the new record.
- **List**: Always include `where: { familyId: userFamilyId }` in queries.

### Auth flow details

- Users authenticate via `/api/auth` with login ID and security PIN
- JWT contains: user ID, name, type, role, family ID, family slug
- Logout via `/api/auth/logout` — token is added to a server-side blacklist
- Token expiration controlled by `AUTH_LIFE` env var (seconds)
- Idle timeout controlled by `IDLE_TIME` env var (seconds)
- Three failed login attempts trigger a 5-minute IP-based lockout (see `/app/api/utils/ip-lockout.ts`)

### System caretaker behavior

- Families with no regular caretakers use a system caretaker (loginId ‘00’) authenticated via the family settings PIN
- Once regular caretakers are configured, the system caretaker is automatically disabled for that family
- System caretakers and settings are created on-demand during auth if they don’t exist

## Form Handling

- Forms use standard React state management with `useState` and `useEffect` — React Hook Form is not used in this project
- Create reusable validation rules and utilities
- Implement consistent error message styling
- Create type-safe form components
- Handle form submission with loading and error states
- Make forms accessible with proper labels and ARIA attributes

## Localization

- **Always use the localization system** for all user-facing text — never hardcode strings in components
- Use the `useLocalization` hook: `const { t, language, setLanguage, isLoading } = useLocalization()` (imported from `@/src/context/localization`)
- Translation keys match their English text exactly, including capitalization and spacing (e.g., `t('Log Entry')` displays “Log Entry” in English)

### Translation files

- Per-language JSON files in `src/localization/translations/`: `en.json`, `es.json`, `fr.json`
- Flat key-value structure — keys are the English text, values are the translated string
- Supported languages are configured in `src/localization/supported-languages.json`
- English (`en.json`) is the fallback — always add keys here first
- After adding or modifying keys, run `node scripts/sort-translation-files.js` to alphabetically sort all translation files

### Adding new user-facing text

1. Add the key to `en.json` (and optionally `es.json`, `fr.json`)
1. Use `t('Your new key')` in the component
1. Run `node scripts/sort-translation-files.js`

### Language preference storage

- **Account-based auth**: stored in `Account.language` field in database, persists across devices
- **Caretaker-based auth (PIN)**: stored in `Caretaker.language` field in database, scoped to that caretaker
- **Unauthenticated**: `localStorage` only, per-device
- The `LocalizationProvider` handles this automatically — fetches from API if authenticated, falls back to localStorage

### API endpoints

- `GET /api/localization` — returns current user’s language preference (requires JWT auth)
- `PUT /api/localization` — updates language preference, body: `{ "language": "es" }` (validates ISO 639-1 code, checks write permissions for expired accounts)

## Testing

- Write tests for all components, custom hooks, and services
- Test error and loading states
- Verify accessibility features
- Test responsive layouts
- Implement integration tests for complex features

## Code Modification Guidelines

- Challenge yourself to write as few lines of code as possible
- When changing existing code, preserve all formatting and styling unless explicitly asked to modify it
- Make only the changes that have been discussed and approved
- Maintain all existing functionality when making modifications
- Ask questions about any ambiguous requirements before implementing changes
- Perform due diligence to ensure accuracy and minimize rewrites