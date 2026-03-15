# Family Management Page - Implementation Plan

This document outlines the implementation plan for creating a secure, enterprise-level Family Management page. This feature is intended for a "Super Admin" role and will be firewalled from the standard user application through a parallel, more secure authentication system.

## High-Level Strategy

The core strategy is to build a distinct, protected section of the application that operates outside the regular family-scoped authentication context.

1.  **Isolated Credentials**: Super admin access will be granted via a unique email and password combination, established during the initial application setup. These credentials will be stored separately from all family and user data.
2.  **Parallel Authentication**: A separate login flow and JWT will be used for the management page. This creates an "airlock"—a super admin must explicitly re-authenticate to gain access to cross-family data, and these privileges are scoped only to the management session.
3.  **Consistent UI/UX Patterns**: While functionally separate, the management page will adhere to the existing UI development patterns, including component structure, styling conventions (Tailwind CSS, light/dark mode), and TypeScript usage, to ensure a consistent look and feel.

---

## Part 1: Infrastructure, Database, & Scripts

The foundation for this feature will be laid during the initial setup.

### 1. Setup Script (`scripts/setup.sh`)
The script will be updated to:
-   Generate a new, cryptographically secure `SUPER_ADMIN_SECRET` and add it to the `.env` file. This secret is used exclusively for signing super admin JWTs.
-   Interactively prompt the user in the terminal to enter an email and password for the initial super admin account.
-   Call a new, dedicated seeder script (`prisma/seedSuperAdmin.ts`) to create the super admin record, passing the credentials securely.

### 2. Database Schema (`prisma/schema.prisma`)
A new, completely isolated table will be added to the schema.
-   **New `SuperAdmin` Model**: This model will store the hashed credentials. It will have **no relations** to the `Family`, `Caretaker`, or any other existing models. This is critical for ensuring these high-privilege credentials are never included in family-specific data backups.
    ```prisma
    model SuperAdmin {
      id        String   @id @default(cuid())
      email     String   @unique
      password  String   // Stores the bcrypt-hashed password
      createdAt DateTime @default(now())
      updatedAt DateTime @updatedAt
    }
    ```

### 3. New Seeder (`prisma/seedSuperAdmin.ts`)
-   This new script's sole responsibility is to create the first super admin. It will receive the email and password from the `setup.sh` script, hash the password using `bcrypt`, and create the single record in the `SuperAdmin` table.

---

## Part 2: Backend API Endpoints

A parallel set of authentication APIs will be created.

### 1. Super Admin Login Endpoint
-   **Route**: `POST /api/auth/super/login`
-   **Function**: Handles the super admin login. It will find the user by email, compare the provided password against the stored hash, and if valid, issue a new, non-family-scoped JWT signed with the `SUPER_ADMIN_SECRET`.

### 2. Super Admin Middleware
-   **Location**: `app/api/utils/auth.ts` (or similar)
-   **Function**: A new `withSuperAdminAuth` middleware will be created. It will protect all management APIs by validating the special super admin JWT, ensuring the request is from a legitimate, escalated session.

### 3. Management API Endpoints
-   A new set of API routes will be created under `app/api/manage/`, for example:
    -   `GET /api/manage/families`: Lists all families.
    -   `PUT /api/manage/families/[id]`: Updates a family's details (name, slug, active status).
    -   All routes in this directory will be protected by the `withSuperAdminAuth` middleware.

---

## Part 3: Frontend Implementation

The frontend will be structured to provide a clean, data-focused experience, reusing existing UI patterns and styles.

### 1. New Route and Layout
-   **Route**: `app/(manage)/manage-families/page.tsx`. A new route group `(manage)` will be used to apply a dedicated layout.
-   **Layout**: `app/(manage)/layout.tsx`. This will be a new, simplified layout. Unlike the main app layout (`app/(app)/[slug]/layout.tsx`), it will not contain the `BabyProvider`, `FamilyProvider`, side navigation, or baby selectors. It will be a clean shell, ensuring the management context is separate from the user-facing application.

### 2. Main Management Component
Following the development patterns seen in components like `src/components/forms/MedicineForm`, a new, modular component will be created.
-   **Location**: `src/components/FamilyManagement/`

#### File-by-File Breakdown:

-   `index.tsx`: This is the main entry point for the management UI. It will manage the "airlock" state, rendering either the `<Login />` component or the main `<Dashboard />` component based on whether a valid super admin JWT has been obtained.

-   `Login.tsx`: A simple, clean form component with "Email" and "Password" fields. On submission, it will call the `POST /api/auth/super/login` endpoint.

-   `Dashboard.tsx`: This component will be rendered after a successful login. It will contain the primary UI for managing families and will orchestrate calls to the various management APIs. It will be composed of other smaller components, like the `FamiliesTable`.

-   `FamiliesTable.tsx`: A reusable table component to display the list of families. It will include functionality for inline editing of names/slugs and a toggle for the `isActive` status.

-   `family-management.types.ts`: Will contain all TypeScript interfaces for the props and data structures used within the `FamilyManagement` components (e.g., `FamilyManagementProps`, `FamilyData`).

-   `family-management.styles.ts`: Will define the component-specific light-mode styles using Tailwind CSS classes, following the pattern in `calendar.styles.ts`. It will use the application's existing color variables (e.g., `--pine`, `--stone`, `--lake`) from `globals.css` to create a consistent, professional theme suitable for a data-dense dashboard.

-   `family-management.css`: Will contain the dark-mode CSS overrides, mirroring the approach used in `calendar.css`.

-   `README.md`: Will provide clear documentation on how to use the `<FamilyManagement />` component, its props, and its purpose. 