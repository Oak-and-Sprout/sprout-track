# ExternalImport

Family-scoped external-platform import flow.

The component currently supports Baby Buddy CSV exports and guides family administrators through:

1. selecting CSV files;
2. previewing detected records and warnings;
3. configuring child destination, source timezone and source units;
4. reviewing the planned import;
5. executing the import and viewing created/already-imported counts.

External imports are additive. The importer does not use database restore endpoints and does not modify or delete existing Sprout Track records.

## Skipped files, activity-only children, and medication imports

- Files that don't match a supported Baby Buddy export are skipped rather than aborting the whole import. The Configure step surfaces a "Files that will be skipped" warning listing each skipped file and its reason; if none of the uploaded files are usable, the preview step blocks progression with an error instead.
- Children that only appear in activity files (no accompanying Child export) are still listed for mapping, but can only be added to an existing baby — the destination defaults to "existing" and the new-baby option is not offered for them. If no existing babies are available yet, the card prompts the user to create one first or include the Child export file.
- Medication export files import as medicine logs. Doses without an amount import with a quantity of 0, surfaced via the `medication-dosage-missing` warning.
- When two or more imported children are mapped to the same existing baby, the Configure and Review steps show a non-blocking "Same destination selected for multiple children" warning (their records would be combined under one baby). Deliberate merging remains possible.
