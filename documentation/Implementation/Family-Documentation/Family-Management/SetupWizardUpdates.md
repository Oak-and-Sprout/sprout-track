# Setup Wizard Updates for Multi-Family Support

This document outlines the implementation plan for updating the Setup Wizard to support a secure, multi-family architecture. The plan enables two distinct modes of operation: one for a fresh database install and another for intentional, admin-driven family creation via sharable links.

## High-Level Strategy

The core of this plan is to evolve the Setup Wizard from a simple first-run tool into a robust component that handles two distinct scenarios:

1.  **"Fresh Install" Mode**: If a user runs the application against a completely empty database, the wizard will launch automatically on the root page (`/`) to guide them through creating the very first family. This preserves the simple "out-of-the-box" experience.

2.  **"Invitation" Mode**: An existing administrator can generate a unique, time-sensitive, and non-guessable setup link via a new API endpoint. When a new user visits this special URL, the wizard will launch to guide them through creating a *new, separate* family. This ensures that all subsequent families are created intentionally and securely.

## Detailed Implementation Plan

### Part 1: Backend & Database Changes

To manage the secure "invitation" flow, we will introduce a new database model and several API endpoints.

#### 1. New `FamilySetup` Model

A new model will be added to `prisma/schema.prisma` to track pending setup invitations. This keeps the primary `Family` table clean, containing only fully configured families.

**File:** `prisma/schema.prisma`

```prisma
model FamilySetup {
  id        String   @id @default(cuid())
  token     String   @unique // A long, random, URL-safe token
  expiresAt DateTime // Invitation links will be valid for a set period (e.g., 7 days)
  createdBy String   // ID of the admin Caretaker who initiated the setup
  familyId  String?  // Linked to the Family record upon creation
  createdAt DateTime @default(now())
}
```

#### 2. New Admin API to Create Setup Links

This endpoint allows an administrator to generate a new family setup invitation.

-   **Route**: `POST /api/family/create-setup-link`
-   **Authentication**: Protected by `withAdminAuth`. Only an existing admin can perform this action.
-   **Logic**:
    1.  Generate a cryptographically secure, random `token`.
    2.  Create a new `FamilySetup` record with the `token`, an expiration date, and the requesting admin's ID.
-   **Output**: A unique URL for the new setup process.
    ```json
    { "success": true, "data": { "setupUrl": "/setup/[token]" } }
    ```

#### 3. New API to Start the Wizard Setup Process

This public endpoint handles the core logic of creating the family, serving both "fresh install" and "invitation" modes.

-   **Route**: `POST /api/setup/start`
-   **Access**: Public (no authentication).
-   **Input**: `{ name: string, slug: string, token?: string }`
-   **Logic**:
    1.  **If `token` is present (Invitation Mode)**: Validate the token against the `FamilySetup` table. If invalid or expired, return a `404 Not Found` error.
    2.  **If `token` is absent (Fresh Install Mode)**: Check if any families exist in the database. If any exist, return a `403 Forbidden` error.
    3.  **For both cases**:
        -   Verify the requested `slug` is unique. If not, return `409 Conflict`.
        -   Create the `Family`, default `Settings`, and default `Unit` records, associating them with the new `familyId`.
        -   If a `token` was used, update the `FamilySetup` record to link it to the newly created `familyId`.
-   **Output**: The details of the newly created family.
    ```json
    { "id": "...", "name": "...", "slug": "..." }
    ```

### Part 2: Frontend Implementation Plan

#### 1. Root Page Logic for Fresh Install

The application's entry point will determine whether to show the wizard or the standard login.

-   **File**: `app/page.tsx`
-   **Logic**:
    1.  On load, call a simple status endpoint (e.g., `GET /api/system/status`) that returns `{ familyCount: number }`.
    2.  If `familyCount === 0`, render the `<SetupWizard />` component.
    3.  Otherwise, render the standard application (e.g., login/dashboard).

#### 2. New Dynamic Route for Invitations

A new page will be created to handle the unique setup URLs.

-   **Route**: `app/setup/[token]/page.tsx`
-   **Logic**:
    1.  Extract the `token` from the URL.
    2.  Perform an initial client-side check to see if the token is likely valid.
    3.  Render the `<SetupWizard />` component, passing the `token` as a prop: `<SetupWizard token={token} />`.

#### 3. `SetupWizard` Component Updates

The main wizard component will be updated to handle both modes.

-   **File**: `src/components/SetupWizard/index.tsx`
-   **Props**: The component will now accept an optional `token` prop. This will be reflected in `src/components/SetupWizard/setup-wizard.types.ts`.
-   **`handleNext` (Stage 1)**:
    -   The logic will call the `POST /api/setup/start` endpoint.
    -   It will send the `familyName`, `familySlug`, and the `token` prop (which will be `undefined` in fresh install mode).
    -   It will handle the `409 Conflict` error by displaying a message to the user (e.g., "That URL is already taken").

#### 4. Supporting Component Changes

-   **File**: `src/components/SetupWizard/FamilySetupStage.tsx`
-   **Change**: This component will be updated to include an input field for the `familySlug`, allowing the user to accept the auto-generated one or create their own.
-   **File**: `src/components/SetupWizard/setup-wizard.types.ts`
-   **Change**: The `SetupWizardProps` and `FamilySetupStageProps` interfaces will be updated to include the new `token` and `familySlug` properties, respectively. 