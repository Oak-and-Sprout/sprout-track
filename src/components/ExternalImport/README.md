# ExternalImport

Family-scoped external-platform import flow.

The component currently supports Baby Buddy CSV exports and guides family administrators through:

1. selecting CSV files;
2. previewing detected records and warnings;
3. configuring child destination, source timezone and source units;
4. reviewing the planned import;
5. executing the import and viewing created/already-imported counts.

External imports are additive. The importer does not use database restore endpoints and does not modify or delete existing Sprout Track records.
