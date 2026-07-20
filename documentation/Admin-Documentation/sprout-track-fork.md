# Sprout Track Fork Maintenance

This fork patch is based on upstream tag `1.6.0` and is intentionally narrow:

- `app/api/hooks/v1/babies/[babyId]/activities/[activityId]/route.ts` adds API-key `PUT` and `DELETE` support for the ten hooks activity types.
- `app/api/hooks/v1/rate-limiter.ts` allows `PUT` and `DELETE` to use the existing write rate limit.
- Webhook documentation describes edit/delete payloads and delete semantics.

## Build a Local Image

```bash
docker build -t sprout-track:1.6.0-hooks-edit-delete .
```

Use the same environment variables, volumes, and database migration process as the upstream `1.6.0` deployment. No Prisma schema migration is required for this patch.

## Rebase When Upstream Releases

```bash
git fetch upstream --tags
git checkout upstream-v1.6.0-hooks-edit-delete
git rebase NEW_UPSTREAM_TAG
npm ci
npm run prisma:generate
npm run prisma:generate:log
npx tsc --noEmit
npm test
docker build -t sprout-track:NEW_UPSTREAM_TAG-hooks-edit-delete .
```

During rebase, inspect conflicts in `app/api/hooks/v1/` and any classic log routes whose update/delete semantics changed upstream. Keep this fork additive where possible so it can be dropped if upstream accepts equivalent hooks edit/delete support.
