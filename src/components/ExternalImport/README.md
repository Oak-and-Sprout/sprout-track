# ExternalImport

Reusable external-platform data import flow.

The component currently supports selecting Baby Buddy CSV exports and requesting a server-side preview. Later steps will add child destinations, units, timezone selection and execution.

## Props

- `isOpen`: Opens the FormPage.
- `onClose`: Closes and resets the importer.

The component never uses the existing database restore endpoints. External imports are additive and family-scoped.
