# ImportFamilyModal

Sysadmin, **per-family** migration import surface for the family-manager area
(`/family-manager/families`). Sits alongside the whole-DB backup/restore in
`AppConfigForm` — this one imports a single family from a hosted export rather than
replacing the entire database.

Opened from the admin side-nav "Import Family" action, which the layout relays to the
families page via the `admin-import-family` window event.

## Flow

1. Upload a `.zip` migration archive → `POST /api/database/import-family` with
   `step=preview` → manifest preview.
2. Choose **new family** (name/slug, prefilled from the manifest) or **append to an
   existing family** (picked from `GET /api/family/manage`), with the dedup toggle for
   append.
3. Confirm → `POST /api/database/import-family` with `step=confirm` → the shared
   `MigrationImport` component renders the report.

The visual flow (preview → mode → warning + dedup → report) is the shared
[`MigrationImport`](../MigrationImport/README.md) component; this modal owns the file
upload, the family list, the mode-specific fields, and the network calls.

## Props

| Prop | Type | Notes |
| --- | --- | --- |
| `isOpen` | `boolean` | Modal visibility. |
| `onClose` | `() => void` | Close handler. |
| `onImported` | `() => void` | Optional; called after a successful import to refresh the family list. |

## Auth

All requests use `authFetch` (Bearer JWT); the endpoint is `withSysAdminAuth`. The
target family is enforced server-side — the UI only chooses among sysadmin-listed
families.
