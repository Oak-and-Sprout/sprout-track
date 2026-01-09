# Next.js Development Rules for Cross-Platform Compatibility

These rules capture the key development patterns from the Web to Mobile Development Primer, focusing specifically on building the initial Next.js application in a way that facilitates future conversion to React Native.

## Tech Stack

 - Next.js with App Router: Core framework for routing, server components, and API routes.
 - TypeScript: For type-safe code.
 - Prisma with SQLite: The ORM and database for data persistence.
 - TailwindCSS: For utility-first styling.
 - React Hooks (useState, useEffect, useContext): Used for all client-side state management, including component state, context-based global state, data fetching, and form handling.

## Project Structure

- Follow the `/src` directory structure with dedicated folders for components, hooks, services, utils, constants, context, types, and styles
- Separate UI components (`/components/ui`) from feature components (`/components/features`)
- Keep component files, styles, types, and documentation together in the same folder
- Include README.md files for components documenting props, usage, and implementation details
- Maintain a consistent naming convention across all files and components

## Component Architecture

- Create "dumb" UI components that are highly configurable through props
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
- Use React Query for data fetching with proper type definitions
- Follow immutable update patterns in all state modifications
- Implement memoization for expensive computations with useMemo
- Include proper error and loading states in all async operations
- Design state management with offline-first principles in mind

## Styling Approach

- Define a shared design system with consistent variables for colors, spacing, typography, etc.
- Use CSS Modules or Styled Components for component styling
- Keep styles modular and component-specific
- Implement responsive design using media queries
- Export theme as TypeScript constants
- Support both light and dark modes through a theme context
- Create helper functions for complex style logic

## Navigation

- Use Next.js's file-system based routing
- Define strongly typed route parameters with TypeScript interfaces
- Create navigation utilities that consolidate route definitions
- Implement type-safe navigation helpers
- Create guards for protected routes in middleware
- Design consistent route structure that will mirror future mobile routes
- Make routes accessible and SEO-friendly

## API and Data Fetching

- Create a type-safe fetch wrapper with proper error handling
- Implement domain-specific API services that use the core API layer
- Use React Query for data fetching with consistent query key patterns
- Implement error handling that provides clear user feedback
- Define optimistic updates for better UX
- Structure API responses with consistent types
- Design with offline capabilities in mind for future mobile support

## Form Handling

- Use React Hook Form for form state management and validation
- Create reusable validation rules
- Implement consistent error message styling
- Create type-safe form components
- Consider implementing a form builder pattern for complex forms
- Handle form submission with loading and error states
- Make forms accessible with proper labels and ARIA attributes

## Testing

- Write tests for all components, custom hooks, and services
- Test error and loading states
- Verify accessibility features
- Test responsive layouts
- Implement integration tests for complex features

## Mobile Considerations

- Avoid web-specific APIs that won't exist in React Native
- Design UI with touch interaction in mind (larger touch targets)
- Consider offline capabilities from the start
- Plan for cross-platform navigation patterns
- Document any web-specific behavior that will need adaptation for mobile

## Localization

- **Always use the localization system** for all user-facing text - never hardcode strings in components
- Use the `useLocalization` hook to access translations: `const { t } = useLocalization()`
- Translation keys match their English text exactly (e.g., `t('Log Entry')` displays "Log Entry" in English)
- When adding new UI text, add the translation key to `/src/localization/translations.json` first
- Translation keys use proper capitalization and spacing to match the English display text
- Always provide English ("en") translations - other languages are optional but should be added when available
- The localization context automatically handles language preference storage (database for authenticated users, localStorage for unauthenticated)
- Language preferences are stored at the Account or Caretaker level based on authentication type
- See `/src/localization/README.md` for detailed documentation on adding translations and languages

## Code Modification Guidelines

- Challenge yourself to write as few lines of code as possible
- When changing existing code, preserve all formatting and styling unless explicitly asked to modify it
- Make only the changes that have been discussed and approved
- Maintain all existing functionality when making modifications
- Ask questions about any ambiguous requirements before implementing changes
- Perform due diligence to ensure accuracy and minimize rewrites