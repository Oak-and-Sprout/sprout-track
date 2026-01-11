# Sprout Track Scripts

This directory contains utility scripts for the Sprout Track application.

## setup.sh

This script performs the initial setup for the Sprout Track application.

### Purpose

This script automates the complete installation process by:
1. Installing dependencies
2. Generating the Prisma client
3. Running database migrations (creates the database schema)
4. Seeding the database with initial data (creates default settings with PIN 111222 and adds units)

### Running the Script

```bash
# Make sure the script is executable
chmod +x scripts/setup.sh

# Run the setup script
./scripts/setup.sh
```

### Output

The script provides detailed output about its progress:
- Status of each installation step
- Error messages if any step fails
- Confirmation when the setup is complete
- The default security PIN (111222)

### When to Use

You should run this script:
1. When setting up a new installation
2. After cloning the repository for the first time
3. When you need to reset the database to its initial state

## generate-test-data.sh

This script generates realistic test data for the Sprout Track application, including families, caretakers, babies, and log entries.

### Purpose

This script creates comprehensive test data to help with development and testing by generating:
- Multiple families with unique slugs and names
- Caretakers (2-4 per family) with realistic roles
- Babies (1-2 per family) with appropriate ages
- Sleep logs with realistic night sleep and nap patterns
- Feed logs with bottle feeding schedules (every 2-4 hours)
- Diaper logs with wet/dirty changes throughout the day

### Running the Script

```bash
# Make sure the script is executable
chmod +x scripts/generate-test-data.sh

# Run the test data generation script
./scripts/generate-test-data.sh
```

### Interactive Setup

The script will prompt you for:
1. **Number of families** (1-20): How many families to generate
2. **Number of days** (1-90): How many days of log entries to create
3. **Clear existing data** (y/N): Whether to delete all existing data first

### Output

The script provides detailed output about its progress:
- Configuration summary with estimated data counts
- Progress for each family being generated
- Breakdown of log entries created per baby
- Final summary with total counts of all generated data

### Generated Data Structure

For each family, the script creates:
- **Family**: Unique slug (e.g., "happy-puppy"), realistic family name
- **Settings**: Default family settings with PIN 111222
- **Caretakers**: 2-4 caretakers per family
  - First caretaker is always a "Parent" with ADMIN role
  - Additional caretakers have varied types (Grandmother, Nanny, etc.)
  - All have access PIN 111222 for testing
- **Babies**: 1-2 babies per family
  - Realistic names based on gender
  - Birth dates ranging from newborn to 24 months old
  - Gender randomly assigned
- **Log Entries** (per baby, per day):
  - **Sleep logs**: Night sleep (9 PM - 7 AM) plus 1-2 naps during the day
  - **Feed logs**: 6 bottle feeds per day (every 2-4 hours)
  - **Diaper logs**: 6-10 diaper changes (60% wet, 25% dirty, 15% both)

### Realistic Patterns

The generated data follows realistic baby care patterns:
- **Night sleep**: 10-12 hours starting around 9 PM
- **Naps**: Morning nap (10 AM-12 PM, 70% chance) and afternoon nap (2 PM-4 PM, 80% chance)
- **Feeding**: Regular bottle feeds at 2 AM, 6 AM, 10 AM, 2 PM, 6 PM, 10 PM with variations
- **Diapers**: Random throughout the day with realistic type distribution
- **Timing**: All activities have natural time variations (±30-45 minutes)

### When to Use

You should run this script:
1. When setting up a development environment
2. Before testing the family manager page
3. When you need sample data to test pagination and search features
4. To populate the database for UI/UX testing
5. When demonstrating the application with realistic data

### Data Access

After generation, you can:
1. Visit `/family-manager` to see all generated families
2. Use PIN `111222` to log into any family
3. Browse the generated log entries in each family's timeline
4. Test search and pagination features with the generated data

## ensure-utc-dates-improved.js

This is an improved version of the UTC date conversion script with better DST handling and more reliable UTC detection.

### Purpose

This script addresses potential issues with Daylight Saving Time (DST) transitions when converting dates to UTC. It uses a more reliable method to detect if a date is already in UTC format.

### Running the Script

```bash
# Run the improved version (recommended)
node scripts/ensure-utc-dates-improved.js
```

## ensure-utc-dates.ts (Original Version)

This script checks and updates all date/time fields in the database to ensure they are stored in UTC format.

### Purpose

In a web application, it's best practice to store all dates in UTC format in the database, and then convert them to the user's local timezone when displaying them in the UI. This script helps ensure that all date fields in the database are properly stored in UTC.

### How It Works

The script:

1. Connects to the database using Prisma
2. Iterates through all models that have date/time fields
3. For each model, retrieves all records
4. Checks each date field to determine if it's already in UTC
5. Converts any non-UTC dates to UTC
6. Updates the database records with the corrected UTC dates

### Running the Script

To run the script:

```bash
# Using the standalone JavaScript version (most reliable)
node scripts/ensure-utc-dates-standalone.js

# OR using the regular JavaScript version
node scripts/ensure-utc-dates.js

# OR using TypeScript with ESM flag
npx ts-node --esm scripts/ensure-utc-dates.ts
```

If you encounter errors:

1. Try the standalone version first, which has no external dependencies
2. If you get an "Unknown file extension '.ts'" error, use one of the JavaScript versions
3. If you get import errors, use the standalone version which has the timezone detection built-in

### Output

The script provides detailed output about its progress:

- The system timezone detected
- Each model being processed
- The number of records found for each model
- Which date fields are being converted for which records
- The total number of records updated for each model
- Confirmation when the process is complete

### When to Use

You should run this script:

1. After migrating data from another system
2. If you suspect that dates might not be stored in UTC
3. After making changes to the timezone handling in the application
4. As part of a database maintenance routine

### Models and Date Fields Processed

The script processes the following models and their date fields:

- Baby: birthDate, createdAt, updatedAt, deletedAt
- Caretaker: createdAt, updatedAt, deletedAt
- SleepLog: startTime, endTime, createdAt, updatedAt, deletedAt
- FeedLog: time, startTime, endTime, createdAt, updatedAt, deletedAt
- DiaperLog: time, createdAt, updatedAt, deletedAt
- MoodLog: time, createdAt, updatedAt, deletedAt
- Note: time, createdAt, updatedAt, deletedAt
- Settings: createdAt, updatedAt
- Milestone: date, createdAt, updatedAt, deletedAt
- PumpLog: startTime, endTime, createdAt, updatedAt, deletedAt
- PlayLog: startTime, endTime, createdAt, updatedAt, deletedAt
- BathLog: time, createdAt, updatedAt, deletedAt
- Measurement: date, createdAt, updatedAt, deletedAt
- Unit: createdAt, updatedAt

### Safety

The script includes error handling to prevent data loss:

- It only updates fields that need conversion to UTC
# Test Data Generation Scripts

This directory contains scripts for generating realistic test data for the Sprout Track application.

## Files

- `generate-test-data.sh` - Main script that can run interactively or in automated mode
- `generate-test-data.js` - JavaScript data generation logic  
- `generate-test-data-automated.sh` - Example script for automated usage
- `README.md` - This documentation file

## Interactive Mode

Run the script interactively to be prompted for parameters:

```bash
./Scripts/generate-test-data.sh
```

The script will ask you for:
- Number of families to generate (1-20)
- Number of days of log entries (1-90)
- Whether to clear existing data

## Automated Mode

The script can be run in automated mode by setting environment variables. This is perfect for cron jobs, CI/CD pipelines, or automated deployments.

### Environment Variables

- `FAMILY_COUNT` - Number of families to generate (1-20)
- `DAYS_COUNT` - Number of days of log entries (1-90)  
- `CLEAR_DATA` - Whether to clear existing data ("true" or "false")

### Example Usage

```bash
# Generate 3 families with 14 days of data, clearing existing data
export FAMILY_COUNT=3
export DAYS_COUNT=14
export CLEAR_DATA=true
./Scripts/generate-test-data.sh
```

Or in a single command:
```bash
FAMILY_COUNT=3 DAYS_COUNT=14 CLEAR_DATA=true ./Scripts/generate-test-data.sh
```

## Cron Job Examples

### Daily Test Data Refresh
```bash
# Run daily at 2 AM to refresh test data
0 2 * * * cd /path/to/sprout-track && FAMILY_COUNT=5 DAYS_COUNT=30 CLEAR_DATA=true ./Scripts/generate-test-data.sh >> /var/log/sprout-track-testdata.log 2>&1
```

### Weekly Test Data Addition
```bash
# Add more test data weekly without clearing existing data
0 3 * * 0 cd /path/to/sprout-track && FAMILY_COUNT=2 DAYS_COUNT=7 CLEAR_DATA=false ./Scripts/generate-test-data.sh >> /var/log/sprout-track-testdata.log 2>&1
```

### Development Environment Setup
```bash
# Generate test data for development environment
0 8 * * 1 cd /path/to/sprout-track && FAMILY_COUNT=3 DAYS_COUNT=14 CLEAR_DATA=true ./Scripts/generate-test-data.sh >> /var/log/sprout-track-testdata.log 2>&1
```

## Generated Data

The script creates realistic test data including:

- **App Configuration**: Global settings (domain: demo.sprout-track.com, HTTPS enabled)
- **Families**: With unique slugs and names
- **Caretakers**: Parents, grandparents, nannies, etc. (2-4 per family)
- **Babies**: With realistic birth dates (1-2 per family)
- **Sleep Logs**: Night sleep and naps with realistic timing
- **Feed Logs**: Bottle feeding schedules (6-8 per day)
- **Diaper Logs**: Wet/dirty diapers throughout the day (6-10 per day)
- **Bath Logs**: Daily baths (80% chance per day)
- **Notes**: General observations (1 every day or two)
- **Milestones**: Developmental achievements (rare special events)

### Time Range

All log entries are generated with timestamps between the start date and a cutoff time that is **15 minutes to 3 hours ago**. This ensures realistic data that doesn't appear to be from the future.

## Data Volume Estimates

For each baby per day:
- Sleep logs: ~4 entries (night sleep + naps)
- Feed logs: ~6 entries (bottle feeds)
- Diaper logs: ~8 entries (changes throughout day)
- Bath logs: ~1 entry (daily bath)
- Notes: ~0.5 entries (every other day)
- Milestones: ~0.05 entries (rare events)

**Total per baby per day: ~19.5 log entries**

## Security

All generated families use the same security PIN: `111222`

This allows easy access to any generated family for testing purposes.

## Error Handling

The script includes validation for:
- Environment variable ranges and types
- Required dependencies (Node.js)
- Database connection
- File system permissions

## Troubleshooting

### Common Issues

1. **Node.js not found**: Install Node.js before running the script
2. **Database connection error**: Ensure the database is accessible
3. **Permission denied**: Make sure the script has execute permissions:
   ```bash
   chmod +x Scripts/generate-test-data.sh
   ```

### Log Output

For automated runs, redirect output to a log file:
```bash
FAMILY_COUNT=3 DAYS_COUNT=14 CLEAR_DATA=true ./Scripts/generate-test-data.sh >> /var/log/testdata.log 2>&1
```

### Debug Mode

For debugging, run with verbose output:
```bash
set -x
FAMILY_COUNT=3 DAYS_COUNT=14 CLEAR_DATA=true ./Scripts/generate-test-data.sh
```

## sort-translation-files.js

This script sorts all translation files alphabetically by their keys to maintain consistent organization.

### Purpose

Translation files can become disorganized when keys are added manually or through various processes. This script ensures all translation files are consistently sorted alphabetically by key, making them easier to navigate and maintain.

### Running the Script

```bash
node scripts/sort-translation-files.js
```

### What It Does

- Sorts all JSON files in `src/localization/translations/` alphabetically by key
- Uses case-insensitive alphabetical ordering
- Preserves all translation values
- Only modifies files that need sorting (won't touch already-sorted files)
- Maintains proper JSON formatting (2-space indentation, trailing newline)

### Output

The script provides feedback about each file:
- `✓ Sorted: filename.json` - File was sorted
- `- Already sorted: filename.json` - File was already in order

### When to Use

You should run this script:
1. After manually adding new translation keys
2. Before committing translation file changes
3. When translation files become disorganized
4. As part of a pre-commit hook (optional)

### Example Output

```
Sorting translation files...

✓ Sorted: en.json
✓ Sorted: es.json
✓ Sorted: fr.json

3 file(s) sorted.
All translation files are now alphabetically sorted by key.
```
