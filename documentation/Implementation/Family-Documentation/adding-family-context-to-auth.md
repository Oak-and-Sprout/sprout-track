# Implementation Plan: Adding Family Context to Authentication

This document outlines the plan to enhance the application's security by embedding family context directly into the authentication token, ensuring all API operations are properly authorized at the family level.

## 1. Problem Statement

The application currently has a critical security vulnerability. The authentication system verifies a user's identity but does not enforce authorization at a family level. API endpoints trust family information sent from the client (e.g., in a URL parameter or request body). This allows a malicious, authenticated user from one family to potentially access or manipulate data from another family by crafting specific API requests with known resource IDs (like `babyId`).

The client-side code relies on a `FamilyProvider` context that determines the family based on the URL slug, which is the source of this insecure, client-driven context.

## 2. The Solution: Token-Based Authorization

The core of the solution is to make the JSON Web Token (JWT) the single, secure source of truth for both a user's identity and their family affiliation. By embedding the `familyId` into the JWT at login, we can create a trustworthy, server-side `AuthContext` that API endpoints can use to authorize every request.

This plan is divided into three phases: securing the backend, refactoring the client-side architecture to align with the backend changes, and final cleanup.

## 3. Phase 1: Secure All API Endpoints (Server-Side)

This phase focuses on locking down the backend to prevent unauthorized cross-family data access.

### 3.1. Enrich the JWT
-   **File:** `app/api/auth/route.ts`
-   **Action:** Modify the login logic to perform a database query that includes the `family` relation when fetching a `Caretaker`.
-   **Outcome:** The `familyId` and `familySlug` will be added to the JWT payload upon successful login.

### 3.2. Update the Core Auth Utility
-   **File:** `app/api/utils/auth.ts`
-   **Action:** Update the `getAuthenticatedUser` function to correctly parse the `familyId` and `familySlug` from the JWT payload.
-   **Outcome:** This information will be available in the `AuthResult` object, which is passed to API handlers via the `withAuthContext` middleware.

### 3.3. Systematically Refactor All API Routes
-   **Pattern:** Apply the following security pattern to every API route (e.g., `/api/baby`, `/api/bath-log`, `/api/note`, etc.).
-   **Actions:**
    1.  Switch the middleware from `withAuth` to `withAuthContext`.
    2.  Remove all usage of the insecure `getFamilyIdFromRequest` utility.
    3.  In every handler (`GET`, `POST`, `PUT`, `DELETE`), retrieve the `familyId` exclusively from the server-side `authContext`.
    4.  **Enforce Authorization:** Before executing any database operation, verify that the resource being accessed belongs to the user's `familyId` from the token.
        -   For **create** (`POST`) operations on a child resource (e.g., a bath log for a baby), first verify that the parent resource (the baby) belongs to the user's family.
        -   For **read, update, or delete** (`GET`, `PUT`, `DELETE`) operations, first fetch the existing record and check if its `familyId` matches the one from the user's token. If it doesn't match, return a `403 Forbidden` error.

## 4. Phase 2: Refactor the Client-Side Architecture

This phase aligns the frontend with the new secure backend, simplifying client-side logic.

### 4.1. Deprecate `FamilyProvider`
-   **File:** `app/context/family.tsx`
-   **Action:** This client-side context is now an anti-pattern. We will phase it out completely.

### 4.2. Introduce a New `AuthProvider`
-   **Action:** Create a new, lightweight client-side context that will be the single source of truth for authenticated user and family data on the frontend.
-   **Functionality:**
    -   On application load, it will read and decode the JWT from `localStorage`.
    -   It will store the user's `id`, `name`, `role`, `familyId`, and `familySlug` in its state.
    -   It will expose this data to all components via a simple `useAuth()` hook.

### 4.3. Refactor Key Components
-   **File:** `app/(app)/[slug]/layout.tsx`
    -   **Action:** Replace `useFamily()` with the new `useAuth()`. All data that previously came from the family context (like the family name in the header) will now come from the auth context.
-   **All Data-Fetching Components & Forms:**
    -   **Action:** Simplify all data-fetching calls. A call like `fetch('/api/baby?familyId=...')` becomes just `fetch('/api/baby')`.
    -   **Action:** Remove the `familyId` from all form submission payloads (e.g., in `BathForm`). The backend no longer needs or trusts this client-sent data.

## 5. Phase 3: Final Cleanup

-   **Action:** Once all API endpoints and client-side components have been refactored according to the plan above, we can safely delete the following files:
    -   `app/api/utils/family.ts`
    -   `app/context/family.tsx`
-   **Outcome:** The final codebase will be more secure, robust, and easier to maintain.

## 6. Refactoring Checklist

This checklist tracks the progress of refactoring each component and its associated API endpoints to use the new token-based family authorization. Each item represents a testable unit of work.

### Core Components
- [x] **Timeline & General Activities**
    - `app/api/timeline/route.ts`
    - `src/components/Timeline/index.tsx`
- [x] **Baby Management**
    - Form: `src/components/forms/BabyForm/`
    - APIs:
        - `app/api/baby/route.ts`
        - `app/api/baby/[id]/route.ts` (Removed)
        - `app/api/baby-last-activities/route.ts`
        - `app/api/baby-upcoming-events/route.ts`
- [x] **Caretaker Management**
    - Form: `src/components/forms/CaretakerForm/`
    - API: `app/api/caretaker/`
- [x] **Settings**
    - Form: `src/components/forms/SettingsForm/`
    - API: `app/api/settings/`

### Activity Log Components
- [x] **Bath Log**
    - Form: `src/components/forms/BathForm/`
    - API: `app/api/bath-log/`
- [x] **Diaper Log**
    - Form: `src/components/forms/DiaperForm/`
    - API: `app/api/diaper-log/`
- [x] **Feed Log**
    - Form: `src/components/forms/FeedForm/`
    - API: `app/api/feed-log/`
- [x] **Measurement Log**
    - Form: `src/components/forms/MeasurementForm/`
    - API: `app/api/measurement-log/`
- [x] **Medicine Log**
    - Form: `src/components/forms/MedicineForm/`
    - APIs:
        - `app/api/medicine/`
        - `app/api/medicine-log/`
- [x] **Milestone Log**
    - Form: `src/components/forms/MilestoneForm/`
    - API: `app/api/milestone-log/`
- [x] **Note Log**
    - Form: `src/components/forms/NoteForm/`
    - API: `app/api/note/`
- [x] **Pump Log**
    - Form: `src/components/forms/PumpForm/`
    - API: `app/api/pump-log/`
- [x] **Sleep Log**
    - Form: `src/components/forms/SleepForm/`
    - API: `app/api/sleep-log/`

### Other Components
- [x] **Calendar**
    - Form: `src/components/forms/CalendarEventForm/`
    - API: `app/api/calendar-event/`
- [x] **Contacts**
    - Form: `src/components/forms/ContactForm/`
    - API: `app/api/contact/`
- [x] **Units**
    - API: `app/api/units/`
- [x] **Family API**
    - API: `app/api/family/`
- [x] **Activity Settings**
    - API: `app/api/activity-settings/`