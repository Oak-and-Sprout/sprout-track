# BackupRestore Component

A standalone component for managing database backup and restore operations in the Baby Tracker application. This component provides a clean interface for users to create database backups and restore from existing backup files.

## Features

- Database backup with automatic file download
- Database restore from uploaded backup files
- Loading states and progress indicators
- Error and success message handling
- Dark mode support
- Cross-platform compatibility
- Proper error handling and user feedback

## Usage

### Basic Usage

```tsx
import { BackupRestore } from '@/src/components/BackupRestore';

// Example usage in a settings form
function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const handleBackupSuccess = () => {
    console.log('Backup completed successfully');
  };
  
  const handleBackupError = (error: string) => {
    console.error('Backup failed:', error);
  };
  
  const handleRestoreSuccess = () => {
    console.log('Restore completed successfully');
    // Page will reload automatically
  };
  
  const handleRestoreError = (error: string) => {
    console.error('Restore failed:', error);
  };
  
  return (
    <div>
      <BackupRestore
        isLoading={isLoading}
        isSaving={isSaving}
        onBackupSuccess={handleBackupSuccess}
        onBackupError={handleBackupError}
        onRestoreSuccess={handleRestoreSuccess}
        onRestoreError={handleRestoreError}
      />
    </div>
  );
}
```

### Import-Only Usage (Initial Setup)

```tsx
import { BackupRestore } from '@/src/components/BackupRestore';

// Example usage during initial setup wizard
function InitialSetupImport() {
  const handleImportSuccess = () => {
    console.log('Database imported successfully during setup');
    // Page will reload automatically after migration
  };
  
  const handleImportError = (error: string) => {
    console.error('Import failed during setup:', error);
    // Error messages are handled by the component
  };
  
  return (
    <BackupRestore
      importOnly={true}
      initialSetup={true}
      onRestoreSuccess={handleImportSuccess}
      onRestoreError={handleImportError}
    />
  );
}
```

## Component API

### BackupRestore

Main component for database backup and restore operations.

#### Props

| Prop | Type | Description | Default |
|------|------|-------------|---------|
| `isLoading` | `boolean` | Whether the parent component is in a loading state | `false` |
| `isSaving` | `boolean` | Whether the parent component is in a saving state | `false` |
| `onBackupSuccess` | `() => void` | Callback when backup operation succeeds | `undefined` |
| `onBackupError` | `(error: string) => void` | Callback when backup operation fails | `undefined` |
| `onRestoreSuccess` | `() => void` | Callback when restore operation succeeds | `undefined` |
| `onRestoreError` | `(error: string) => void` | Callback when restore operation fails | `undefined` |
| `className` | `string` | Custom CSS classes for the container | `undefined` |
| `importOnly` | `boolean` | Whether to show only import/restore functionality (hides backup button) | `false` |
| `initialSetup` | `boolean` | Whether this is being used during initial setup (uses different migration API) | `false` |
| `onMigrationFile` | `(file: File) => void` | When set, the restore button becomes a unified **Import** button: the picked file is inspected first (via `detectImportFileKind`) and a single-family migration export is handed off here (for the migration flow) instead of being restored as a database backup. A `.db`/backup zip still restores; an unrecognized file shows an inline error. | `undefined` |

## Visual Behavior

- Displays a section header with "Database Management" title (or "Import Previous Data" in import-only mode)
- Two action buttons: "Backup Database" and "Restore Database" (or just "Import Database" in import-only mode)
- Help text explaining the functionality (contextual based on mode)
- Error messages appear in red styling when operations fail
- Success messages appear in green styling when operations succeed
- Migration progress indicators show during database migration steps
- Buttons are disabled during operations to prevent conflicts
- Restore button shows "Restoring..."/"Importing..." text when a restore is in progress

## Implementation Details

The component handles all database backup and restore logic internally:

### Backup Process
1. Makes an authenticated request to `/api/database` with GET method
2. Downloads the response as a blob
3. Creates a temporary download link and triggers the download
4. Cleans up the temporary URL and DOM elements
5. Shows success/error messages based on the result

### Restore Process
1. Accepts a `.db` file through a hidden file input
2. Uploads the file to `/api/database` (normal mode) or `/api/database/restore-initial` (initial setup mode) with POST method using FormData
3. Shows progress during the upload
4. **Automatically runs post-restore migrations** to update older database schemas
5. Displays detailed progress during migration steps
6. Reloads the page after successful restore and migration
7. Shows detailed error messages if any step fails

### Post-Restore Migration
When restoring from an older backup, the component automatically runs a migration process that includes:
- **Prisma Client Generation**: Ensures the client matches the current schema
- **Schema Migrations**: Updates the database structure to the current version using Prisma migrations
- **Family Data Migration**: Converts single-family data to multi-family structure if needed
- **Database Seeding**: Adds any new default settings, units, and required data

This ensures that restored databases are fully compatible with the current application version.

**⚠️ Security Requirement**: Database migration operations require **system administrator authentication**. Only users authenticated as system administrators can perform post-restore migrations. Regular family administrators do not have sufficient privileges for these operations.

## Error Handling

The component provides comprehensive error handling:
- Network failures during backup/restore operations
- Invalid file types (only `.db` files accepted)
- Authentication errors (uses stored auth token)
- **Authorization errors**: Clear messages when system admin privileges are required
- Server-side errors during processing
- **Migration failures**: Detailed error messages when schema migrations fail
- **Compatibility issues**: Clear feedback when database versions are incompatible
- **Partial failures**: Distinguishes between restore failures and migration failures

## File Structure

```
src/components/BackupRestore/
├── index.tsx                    # Main component
├── backup-restore.types.ts      # TypeScript interfaces
├── backup-restore.styles.ts     # Tailwind CSS styles (light mode)
├── backup-restore.css          # Dark mode CSS overrides
└── README.md                   # This documentation

Related API Endpoints:
├── /api/database                    # Backup (GET) and restore (POST) operations (System Admin only)
├── /api/database/restore-initial    # Initial setup restore operations (Setup Auth allowed)
├── /api/database/migrate            # Post-restore migration operations (System Admin only)
└── /api/database/migrate-initial    # Initial setup migration operations (Setup Auth allowed)
```

## Cross-Platform Considerations

This component is designed with cross-platform compatibility in mind:

- Uses standard web APIs that can be adapted for mobile environments
- File download mechanism can be replaced with platform-specific file sharing
- Authentication handling uses localStorage, which has mobile equivalents
- UI components follow responsive design patterns
- Error handling patterns are platform-agnostic

When converting to React Native:
- Replace file download with platform-specific file sharing APIs
- Use React Native's DocumentPicker for file selection
- Adapt authentication token storage to use AsyncStorage
- Replace CSS styling with React Native StyleSheet

## Integration Example

### With AppConfigForm

```tsx
import { BackupRestore } from '@/src/components/BackupRestore';

export default function AppConfigForm({ isOpen, onClose }: AppConfigFormProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  return (
    <FormPage isOpen={isOpen} onClose={onClose} title="App Configuration">
      <FormPageContent>
        {/* Other form content */}
        
        <BackupRestore
          isLoading={loading}
          isSaving={saving}
          onBackupError={(error) => setError(error)}
          onRestoreError={(error) => setError(error)}
        />
      </FormPageContent>
    </FormPage>
  );
}
```

## Migration Troubleshooting

### Common Migration Issues
- **Schema incompatibility**: Older databases may require manual schema updates
- **Missing dependencies**: Ensure all npm packages are installed before migration
- **Permission errors**: Database file must be writable by the application
- **Family structure**: Very old databases may need manual family data conversion

### Manual Migration Fallback
If automatic migration fails, you can run migrations manually:
```bash
# Generate Prisma client
npm run prisma:generate

# Run schema migrations
npx prisma migrate deploy
# or for development
npm run prisma:migrate

# Run family migration (if needed)
node scripts/family-migration.js

# Seed with default data
npm run prisma:seed
```

### Deployment Integration
This component integrates with the project's deployment scripts:
- Uses the same migration order as `scripts/update.sh`
- Follows the same error handling patterns as `scripts/deployment.sh`
- Leverages existing migration scripts (`family-migration.js`, `seed.ts`)

## Security Considerations

- All API requests include authentication tokens when available
- File upload validation is handled server-side
- Only `.db` files are accepted for restore operations
- Error messages don't expose sensitive system information
- Temporary URLs are properly cleaned up after downloads
- **System Admin Authentication**: Database operations require appropriate authentication
  - **Standard backup/restore**: Requires system administrator privileges (`withSysAdminAuth`)
  - **Initial setup restore**: Allows system admin OR setup authentication (`withAuthContext`)
  - **Migration operations**: System admin only (standard) or setup auth allowed (initial setup)
  - Clear error messages guide users who lack sufficient privileges
- **Migration security**: Server-side scripts run with application privileges
- **Backup validation**: Restored databases are validated before migration begins
- **App Configuration Security**: System configuration endpoints also require system admin authentication 