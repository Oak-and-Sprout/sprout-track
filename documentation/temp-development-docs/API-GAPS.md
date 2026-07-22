# Sprout Track Webhook API — Gaps and Rough Edges

Findings from building a hardware client against `/api/hooks/v1`. Every item
below was verified empirically against a live instance, not inferred from the
documentation. Each entry lists what was sent, what came back, and what was
actually stored on read-back.

Tested against the hosted instance on 2026-07-20, API version 1. Updated
2026-07-21 with a review of the API source (`app/api/hooks/v1` at commit
`72d19ca2`) — items 1–8 now carry code citations where the source confirms or
corrects the observed behavior, and items 10+ are new findings from the source
itself. `activities/route.ts` below is shorthand for
`app/api/hooks/v1/babies/[babyId]/activities/route.ts`.

Severity is from an integrator's point of view:

- **High** — can cause silent data loss; a client can look correct and be wrong
- **Medium** — forces guesswork or produces inconsistent data
- **Low** — friction, confusing but self-correcting

---

## Status update — 2026-07-22

Most of the items below were addressed by a four-commit fix batch on branch
`2026-july-6` (built on top of PR #228, which had already added the hooks
PUT/DELETE endpoints):

- `b24fb403` — setup-token hardening (unrelated to the webhook items in this
  doc; closes the `auth.ts:747` residual documented in PR #236)
- `d734ecaf` — hooks POST correctness: resolves items **1** (unknown fields
  now `400 INVALID_FIELD`), **2** (`totalAmount` writable), **4**
  (`creamApplied` writable and returned on GET), **7** (zero-vs-absent;
  medicine/supplement `amount` now required), **11** (`CARETAKER_NOT_FOUND`),
  **12** (medicine/supplement `notes` and measurement `caretakerId` wired
  through; measurement GET `caretakerName` resolved). Item **6** partially:
  non-boolean values now return `400`, but the default-true-on-omission
  behavior remains (a schema migration was judged out of scope for this
  batch — see "Deferred" below).
- `aa0b557c` — validation/normalization: resolves the write side of items
  **3** and **10** (`condition`/`color`/`quality` validated and
  case-normalized; `bathType` normalizes known values, custom values pass
  through verbatim), **5** (reference dedup fixed), **13** (`unitAbbr`
  validated, `units` reference type added, `status`/`activities` read
  fallback aligned). Also validates `bottleType`/`side` on POST and PUT
  (not previously called out as a numbered item, but the same free-form
  problem as item 3).
- `ad2d7d65` — PUT polish: sleep `duration` recomputed from `endTime` when
  not explicitly provided; a `null` medicine/supplement dose is now rejected
  with `400` instead of being fabricated to `0`.

`documentation/Admin-Documentation/webhook-api.md` was updated alongside
every one of the fix commits above, closing most of item 9's documentation
gaps.

**Resolved:** 1, 2, 3 (write side), 4, 5, 7, 10 (write side), 11, 12, 13, 9
(mostly).
**Partially resolved:** 6 (validation only; default-true unchanged).
**Not addressed:** 8, 14.
See "Deferred — future work" at the end of this document for what remains,
why it was deferred, and enough context to pick each item back up.

---

## 1. Unrecognized fields are accepted and silently discarded — High

> **RESOLVED 2026-07-22** (commit `d734ecaf`): unknown fields now return
> `400 INVALID_FIELD` naming the offending field(s), instead of a silent
> `200`. See `webhook-api.md` line ~299. Evidence below reflects the
> pre-fix behavior and documents why the change was made.

The API returns `200 {"success": true}` for payloads containing fields it does
not recognize. The response body echoes only the fields it kept, but nothing
signals that anything was dropped.

```jsonc
// sent
{"type":"pump","action":"log","duration":1,"amount":5,"unitAbbr":"OZ"}

// response: 200, success true
{"details":{"action":"log","duration":1}}

// stored
{"leftAmount":null,"rightAmount":null,"totalAmount":null,"unitAbbr":"OZ"}
```

An integrator writing "log a pump of 5 oz" gets a success response and a record
with no volume at all. The failure is invisible without a read-back.

This is the single highest-risk behavior in the API, because it turns a typo or
a wrong field name into permanent silent data loss rather than an error.

**Suggested fix:** reject unknown fields with `400`, or return a
`meta.ignoredFields` array so clients can detect the problem.

---

## 2. `totalAmount` is derived but looks writable — High

> **RESOLVED 2026-07-22** (commit `d734ecaf`): `totalAmount` is now a
> writable field — sending it alone records a total without attributing it
> to either side; if sent together with a side, the explicit `totalAmount`
> wins over the derived sum. Evidence below reflects the pre-fix behavior.

Pump records expose `totalAmount`, but it is computed from
`leftAmount + rightAmount` and cannot be set directly. Sending it alone stores
nothing, per the behavior in item 1.

```jsonc
{"type":"pump","action":"log","duration":1,"totalAmount":7,"unitAbbr":"OZ"}
// -> stored: leftAmount null, rightAmount null, totalAmount null

{"type":"pump","action":"log","duration":1,"leftAmount":6,"unitAbbr":"OZ"}
// -> stored: leftAmount 6, rightAmount null, totalAmount 6   (derived)
```

Any UI that asks for a single total — which is the natural question for a
physical button — has to either split the value across sides or attribute all
of it to one side. Both fabricate per-side data.

**Suggested fix:** accept `totalAmount` as an input that populates the total
without implying a side, or document explicitly that it is read-only.

---

## 3. Free-form fields with no reference endpoint — Medium

> **RESOLVED 2026-07-22 (write side)** (commit `aa0b557c`): `condition`,
> `color`, `quality`, and `bottleType`/`side` are now validated and
> case-normalized to their canonical casing on both POST and PUT; unknown
> values are rejected with `400` listing the accepted values. `bathType`
> normalizes its known built-in values but still passes unrecognized custom
> text through verbatim (deliberate — the app supports free-text custom bath
> types). `GET /reference` gained `diaper-conditions`, `diaper-colors`,
> `sleep-qualities`, `bath-types`, and `units`. The historical-data half of
> this item (existing rows already stored in mixed casing) is **not**
> addressed — see item (c) under "Deferred" below. Evidence below reflects
> the pre-fix behavior.

`GET /reference` covers `medicines`, `supplements`, `sleepLocations`,
`playCategories`, and `feedTypes`. It does **not** cover:

| Field | Behavior |
|---|---|
| `bath.bathType` | Free-form string, no reference, no validation |
| `diaper.condition` | Free-form string, no reference, no validation |
| `diaper.color` | Free-form string, no reference, no validation |
| `sleep.quality` | Free-form string, no reference, no validation |
| `note.category` | Free-form string, no reference, no validation |

These are presented as dropdowns in the app, so they have a canonical set — but
an API client cannot discover it. Values must be hardcoded by reading the app's
UI, and they silently drift if the app's list changes.

Source review confirms: the diaper handler stores `condition || null` and
`color || null` verbatim (`activities/route.ts:396-398`), and the canonical
sets live only in the form components:

- `diaper.condition`: `NORMAL`, `LOOSE`, `FIRM`, `OTHER`
  (`src/components/forms/DiaperForm/index.tsx:333-336`)
- `diaper.color`: `YELLOW`, `BROWN`, `GREEN`, `BLACK`, `RED`, `OTHER`
  (`DiaperForm/index.tsx:353-358`)
- `sleep.quality`: `POOR`, `FAIR`, `GOOD`, `EXCELLENT`
  (`src/components/forms/SleepForm/index.tsx:706-709`)
- `bath.bathType`: `Full Bath`, `Sponge Bath`, `Wipe Down`, plus free-text
  custom (`src/components/forms/BathForm/index.tsx:34`)

Note the casing is itself inconsistent across types: diaper and sleep values
are `UPPER_CASE` enum-style tokens, while bath types are title-case display
strings. A client cannot guess the convention per field.

Verified unvalidated:

```jsonc
{"type":"diaper","diaperType":"WET","condition":"ZZZ_BOGUS"}
// -> 200, stored verbatim as condition "ZZZ_BOGUS"
```

The same for `color`. A typo becomes a permanent record that no app filter will
ever match.

Note the case mismatch too: the app displays `Normal` / `Yellow`, but stores
`NORMAL` / `YELLOW`. Nothing in the API surfaces that transformation, so a
client sending the display string produces records inconsistent with the app's
own.

**Suggested fix:** add `?type=bath-types`, `diaper-conditions`,
`diaper-colors`, and `sleep-qualities` to `GET /reference`, and validate
against them. See also item 10 for the concrete damage this does inside the
app's own UI.

---

## 4. App fields with no API equivalent — Medium

> **RESOLVED 2026-07-22** (commit `d734ecaf`): `creamApplied` is now a
> accepted boolean field on diaper create (and PUT), and is included in the
> `GET /activities` response for diaper entries. It still defaults to
> `false` when omitted, matching the schema default and the app's own
> behavior. Evidence below reflects the pre-fix behavior.

The app's **Log Diaper Change** form has a **Diaper Cream Applied** checkbox.
There is no corresponding webhook API field. Four plausible names were tested
in a single request — `diaperCream`, `creamApplied`, `diaperCreamApplied`,
`cream` — and none persisted:

```jsonc
// sent (all four, plus valid fields)
{"type":"diaper","diaperType":"BOTH","blowout":true,"condition":"NORMAL",
 "color":"YELLOW","diaperCream":true,"creamApplied":true,
 "diaperCreamApplied":true,"cream":true}

// stored
{"type":"BOTH","condition":"NORMAL","color":"YELLOW","blowout":true}
```

An API client cannot record everything the app can, so records created via the
API are not round-trip equivalent to records created in the UI.

Source review resolves the mystery: the real field is `creamApplied` — an
actual column on `DiaperLog` (`prisma/schema.prisma:441`, `@default(false)`)
that the app form writes — but the webhook handler destructures only
`diaperType`, `condition`, `color`, `blowout`
(`activities/route.ts:392`), and the GET path never returns it either
(`activities/route.ts:82`). So the guessed name was right and still dropped.
Worse, the `false` default means every API-created record positively asserts
"no cream applied" rather than "unknown".

**Suggested fix:** accept and return `creamApplied`, or document which app
fields are API-inaccessible.

---

## 5. Reference data contains duplicates and legacy values — Medium

> **RESOLVED 2026-07-22** (commit `aa0b557c`): `sleep-locations` dedup now
> ignores case and underscore/space differences, preferring the
> display-cased variant — a legacy `CAR_SEAT` value collapses onto
> `Car Seat` instead of appearing as a separate entry. Evidence below
> reflects the pre-fix behavior.

`GET /reference?type=sleep-locations` returned:

```json
["Bassinet","Stroller","Crib","Car Seat","Parents Room","Contact","Other","CAR_SEAT"]
```

`CAR_SEAT` appears alongside `Car Seat` — evidently a legacy enum token leaking
in next to its display string. A client that renders the reference list
verbatim shows the user two identical-looking choices that write different
values, splitting the same real-world location across two values in reporting.

Since the endpoint's purpose is telling clients what is safe to send, it should
not require client-side cleanup.

Source review shows why: the list is the hardcoded defaults merged with every
distinct `location` value ever stored in `sleepLog`, deduplicated
case-insensitively (`app/api/hooks/v1/babies/[babyId]/reference/route.ts:31-45`).
`CAR_SEAT` differs from `Car Seat` by an underscore, so the dedup misses it.
The deeper problem is the feedback loop: because writes are unvalidated
(item 3), any typo ever logged becomes a permanent "valid" suggestion that the
reference endpoint then serves to every future client.

**Suggested fix:** de-duplicate and normalize, or return objects with explicit
`value` and `label` fields the way `feedTypes` already does.

---

## 6. Booleans that default to true — Medium

> **PARTIALLY RESOLVED 2026-07-22** (commit `d734ecaf`): `soapUsed` and
> `shampooUsed` (and `blowout`/`creamApplied`) must now be real JSON booleans
> if sent — a non-boolean value (the string `"false"`, `1`, etc.) returns
> `400 INVALID_FIELD` instead of being silently coerced. The
> default-true-on-omission behavior itself is **unchanged** — this needs a
> schema/data decision, not just a validation fix. See item (a) under
> "Deferred" below. Evidence below reflects the original (still partially
> current) behavior.

Bath `soapUsed` and `shampooUsed` default to `true` when omitted. Omitting a
field therefore asserts a positive fact rather than leaving it unknown.

Explicit `false` is honored correctly:

```jsonc
{"type":"bath","bathType":"Sponge Bath","soapUsed":false,"shampooUsed":true}
// -> stored exactly as sent
```

The trap is that a minimal payload silently records "soap and shampoo were
used". Any client that omits these because it does not collect them is
generating fabricated data.

In source, the check is `soapUsed !== false` (`activities/route.ts:515`) — so
not just omission but *any* value other than literal `false` (the string
`"false"`, `0`, `null`) stores `true`. Note the inconsistency with diaper's
`blowout === true` (`activities/route.ts:397`), which goes the other way: any
value other than literal `true` silently stores `false`.

**Suggested fix:** default to `null`/unknown rather than `true`, and reject
non-boolean values.

---

## 7. Zero versus absent is handled differently per type — Medium

> **RESOLVED 2026-07-22** (commit `d734ecaf`): pump `leftAmount`/
> `rightAmount`/`totalAmount` now distinguish an explicit `0` (stored as `0`,
> a genuine empty pump) from an omitted field (stored as `null`, unknown).
> Medicine/supplement `amount` is now **required** — omitting it, or sending
> `null` or a non-numeric value, returns `400 INVALID_AMOUNT` instead of
> fabricating a dose of `0`. Evidence below reflects the pre-fix behavior.

An earlier draft of this item said sending `0` records a real zero and
omitting leaves null. Source review shows that is only true for one type;
elsewhere the handlers use JavaScript truthiness, which conflates `0` with
absent — or worse, conflates absent with `0`:

| Field | Code | `0` sent | Omitted |
|---|---|---|---|
| `measurement.value` | explicit null check, `activities/route.ts:526-530` | stores `0` | `400` error |
| `feed.amount` | `amount ? parseFloat(amount) : null`, line 384 | stores `null` | stores `null` |
| `pump.leftAmount` / `rightAmount` | same pattern, lines 489-490, 501-502 | stores `null` | stores `null` |
| `pump.totalAmount` (derived) | `(left \|\| 0) + (right \|\| 0) \|\| null`, lines 491, 503 | `0 + 0` → `null` | `null` |
| `medicine` / `supplement` `amount` | `amount ? parseFloat(amount) : 0`, lines 557, 587 | stores `0` | **stores `0`** |

The last row is the inverse trap: omitting a medicine dose fabricates a
recorded dose of zero. And a pump that genuinely produced nothing cannot be
recorded as such — an explicit `0` is erased to `null`.

**Suggested fix:** distinguish `undefined` from `0` everywhere
(`amount !== undefined ? parseFloat(amount) : null`), and document the
zero-versus-absent semantics.

---

## 8. Wrong base path returns an HTML 404, not a JSON error — Low

> **NOT ADDRESSED as of 2026-07-22.** Still open — see item (b) under
> "Deferred" below.

Instances are reached at `https://host/<family-slug>`, but the API lives at
`https://host/api/hooks/v1` — the slug is not part of the API path, since keys
are already family-scoped. Including it is a natural first guess and returns a
full HTML 404 page rather than the documented error envelope:

```
GET https://host/sweet-slug/api/hooks/v1/babies   -> 404, text/html
GET https://host/api/hooks/v1/babies              -> 200, application/json
```

A client parsing JSON gets a decode error rather than a diagnosable message,
which reads like an auth or transport problem.

**Suggested fix:** return the standard JSON error envelope for unmatched
`/api/` paths, and state the slug rule explicitly in the docs.

---

## 9. Documentation gaps

> **MOSTLY RESOLVED 2026-07-22** (commits `d734ecaf`, `aa0b557c`,
> `ad2d7d65`): `webhook-api.md` was updated alongside each fix commit in this
> batch and now documents unknown-field rejection, `totalAmount` writability,
> validation/normalization of `condition`/`color`/`quality`/`bottleType`/
> `side`/`bathType`/`unitAbbr`, the `soapUsed`/`shampooUsed` default-true
> quirk (explicitly called out as "an existing quirk of the underlying
> schema default, not a new behavior"), and the new `notes`/`caretakerId`
> wiring. The two bullets below about `lastActivities.sleep.type` and the
> example-response PII were not specifically re-verified in this pass — see
> item (h) under "Deferred" below.

Behaviors that cost time and are not in `webhook-api.md`:

- Unknown fields are ignored rather than rejected (item 1)
- `totalAmount` is read-only (item 2)
- `bathType`, `condition`, and `color` are unvalidated free-form (item 3)
- Stored values are upper-cased relative to app display labels (item 3)
- `soapUsed` / `shampooUsed` default to `true` (item 6)
- `lastActivities.sleep.type` is the field carrying `NAP` / `NIGHT_SLEEP`,
  needed to label an in-progress sleep correctly
- The example `GET /babies` response in the published documentation contained a
  real baby UUID and first name from a live instance

---

# Findings from source review — 2026-07-21

Items above were found by testing a live instance. The items below come from
reading the API implementation and the app's form components directly
(sprout-track commit `72d19ca2`).

---

## 10. Case-inconsistent `condition`/`color` values break the app's edit UI — Medium

> **RESOLVED 2026-07-22 (write side)** (commit `aa0b557c`): new writes via
> the hooks API are case-normalized to the canonical uppercase tokens on
> both POST and PUT, so this drift stops accumulating for records created
> going forward. Rows already stored in mixed casing before this fix are
> **not** migrated — see item (c) under "Deferred" below. Evidence below
> reflects the pre-fix behavior and the underlying bug report.

Reported as [Oak-and-Sprout/sprout-track#235](https://github.com/Oak-and-Sprout/sprout-track/issues/235).
This is the app-side consequence of item 3: because the API stores
`condition`/`color` verbatim with no validation or normalization, a client
that sends `"loose"` instead of `"LOOSE"` produces a record that *displays*
fine in the timeline but leaves the edit form's dropdown blank — the
`<Select>` only matches the exact uppercase tokens. Editing and re-saving
such a record then writes a third casing variant (`"Loose"`, `"Green"`), so
one real-world value can exist in the database in three spellings, none of
which group together in filters or reports.

**Suggested fix:** normalize known values case-insensitively on write (and
reject unknowns per item 3); as a migration, normalize existing rows.

---

## 11. Unknown `caretakerName` is silently dropped — Medium

> **RESOLVED 2026-07-22** (commit `d734ecaf`): a `caretakerName` that
> doesn't match any of the family's caretakers now returns
> `400 CARETAKER_NOT_FOUND` listing the available names, matching the
> pattern this item suggested (the medicine handler's existing
> `medicineName` behavior, applied to `caretakerName` too), instead of
> creating the activity unattributed. Evidence below reflects the pre-fix
> behavior.

`caretakerName` is resolved with an exact, case-sensitive match against the
family's caretakers, and a miss returns `null` with no error
(`activities/route.ts:13-24`). The activity is then created unattributed, the
response is a normal `200` success, and nothing in it echoes the caretaker.
A client with a misspelled or renamed caretaker logs every activity as
"nobody" and never finds out without a read-back.

**Suggested fix:** return `400 CARETAKER_NOT_FOUND` (the medicine handler
already does exactly this for `medicineName`, with an "Available: …" hint —
same pattern, one field over), or at minimum echo the resolved caretaker in
the response.

---

## 12. The write path silently drops fields the read path exposes — Medium

> **RESOLVED 2026-07-22** (commit `d734ecaf`): `medicine.notes` and
> `supplement.notes` are now persisted and returned by `GET /activities`.
> Measurement `caretakerId` is now wired through on create, and
> `GET /activities` resolves the measurement's `caretakerName` instead of
> hardcoding `null`. Note that `notes` was deliberately **not** extended to
> pump/measurement POST in this batch — see item (g) under "Deferred" below
> for why. Evidence below reflects the pre-fix behavior.

A sharper variant of item 1: these are not unknown fields, they are fields the
API itself returns on GET, which makes them look writable.

- **`medicine.notes` / `supplement.notes`** — destructured from the request
  body but never passed to the create call
  (`activities/route.ts:536,556-558` and `565,586-588`), while
  `GET /activities` returns `notes` for both types (lines 195, 214). A client
  that round-trips a record it just read loses the notes.
- **`measurement` caretaker attribution** — `caretakerName` is accepted and
  resolved for every type, but the measurement create omits `caretakerId`
  entirely (`activities/route.ts:529-531`), and the GET path hardcodes
  `caretakerName: null` (line 177). Measurements logged via the API can never
  be attributed, even though the schema supports it.

**Suggested fix:** wire `notes` and `caretakerId` through the create calls —
both are one-line fixes.

---

## 13. `unitAbbr` is free-form, undiscoverable, and read back inconsistently — Medium

> **RESOLVED 2026-07-22** (commit `aa0b557c`): `unitAbbr` is now validated
> case-insensitively against the family's configured `Unit` table on both
> POST and PUT, and stored using the table's exact casing; an unrecognized
> value returns `400 INVALID_UNIT` listing the units actually configured.
> `GET /reference` gained a `units` type. `GET /status`'s `lastFeed.unitAbbr`
> now falls back to the raw stored string the same way `GET /activities`
> already did, so the two read paths agree. Evidence below reflects the
> pre-fix behavior.

`unitAbbr` on feed, pump, and medicine writes is stored verbatim
(`activities/route.ts:384`), there is no `?type=units` in `GET /reference`,
and nothing validates the value against the `Unit` table. The read paths then
disagree about what to do with a non-matching value: `GET /activities` falls
back to the raw string (`r.unit?.unitAbbr || r.unitAbbr`, line 63), but
`GET /status` uses only the relation (`lastFeed.unit?.unitAbbr || null`,
`status/route.ts:150`) — so a feed logged with `"oz"` where the table has
`"OZ"` shows its unit in one endpoint and `null` in the other.

**Suggested fix:** add `units` to `GET /reference`, validate on write, and
make the two read paths use the same fallback.

---

## 14. `GET /activities` pagination is approximate — Low

> **NOT ADDRESSED as of 2026-07-22.** Still open, including the "document it
> as best-effort" fallback this item suggested — see item (d) under
> "Deferred" below.

`limit` is applied per activity type before the results are merged and
re-trimmed (`activities/route.ts:38,240-247`), and `hasMore` only reports
whether the *merged* list overflowed — it says nothing about rows beyond the
per-type `take` in the database. With the default `since` of the last 24
hours, a quiet type's history is invisible unless the client passes `since`
explicitly. Fine for dashboards, misleading for anything trying to sync.

**Suggested fix:** document `hasMore` as best-effort and the `since` default,
or implement real cursor pagination.

---

## What works well

Worth stating, since the above is all criticism:

- The `{success, data, meta}` envelope is consistent, and `meta` echoing
  `familyId` / `babyId` makes it obvious which record a write landed on.
- Timer semantics are genuinely good. Breastfeed and sleep sessions started via
  the API are live in the app and can be ended there, and vice versa —
  `start` / `switch` / `pause` / `resume` / `end` all behave as documented.
  This is the hard part and it is done well.
- `GET /status` is well-designed for dashboards: last-activity-per-type, daily
  counts, and overdue warnings computed against the family's own thresholds, in
  one request. It made a live status display nearly free.
- Rate limits (60 GET/min, 30 POST/min) are generous for this class of client
  and the headers are correct.
- Error codes for auth and scope failures are specific and actionable.

---

## Deferred — future work

Items intentionally left unaddressed by the 2026-07-22 fix batch (commits
`b24fb403`, `d734ecaf`, `aa0b557c`, `ad2d7d65` on branch `2026-july-6`), with
enough context to pick each one up cold.

### (a) Item 6's remaining half — `soapUsed`/`shampooUsed` default-true

`BathLog.soapUsed` and `BathLog.shampooUsed` are `@default(true)` in
`prisma/schema.prisma`, and the hooks POST/PUT handlers rely on that same
default rather than distinguishing "omitted" from "explicitly true". Fixing
this for real requires a schema decision (make the columns nullable, with
`null` meaning "unknown", and a migration to backfill existing rows — almost
certainly to `null` rather than guessing `true`/`false` for history), plus
updating every place in the app that reads these fields to treat `null` as
"not recorded" rather than falsy. Out of scope for a hooks-route-only fix;
needs its own migration-bearing task.

### (b) Item 8 — HTML 404 for unmatched `/api` paths

Requests to a path under `/api/` that doesn't match any route (most commonly
a client mistakenly including the family slug, e.g.
`/sweet-slug/api/hooks/v1/babies`) still fall through to Next.js's default
HTML 404 page instead of the API's JSON error envelope. The fix is a
catch-all route (or middleware matcher) under `app/api/` that returns
`{success: false, error: ...}` with `content-type: application/json` for any
unmatched `/api/*` path. Not attempted in this batch since it's routing
infrastructure rather than a hooks-handler change, and touches middleware
shared by the whole app, not just the webhook surface.

### (c) Item 10's data migration — historical case-variant rows

The write-side fix (commit `aa0b557c`) stops new drift, but any
`DiaperLog.condition`/`.color` rows already stored in non-canonical casing
(e.g. `"loose"`, `"Green"`) before this fix are still in the database exactly
as they were. A follow-up data migration should normalize existing rows to
the canonical uppercase tokens (`NORMAL`/`LOOSE`/`FIRM`/`OTHER`,
`YELLOW`/`BROWN`/`GREEN`/`BLACK`/`RED`/`OTHER`) using the same
`normalizeEnumValue` matching logic added to `app/api/hooks/v1/field-values.ts`,
so historical records group correctly in the app's edit UI, filters, and
reports. Deferred because it's a one-time data cleanup, not a code-correctness
issue, and should run as an explicit, reviewable migration rather than inside
a route handler.

### (d) Item 14 — `GET /activities` pagination is still approximate

Not touched in this batch. `limit` is still applied per activity type before
merging, and `hasMore` still only reflects overflow of the *merged* list, not
whether more rows exist per-type in the database. The lighter documentation
fix suggested in the original item (explicitly stating `hasMore` is
best-effort and documenting the `since` default) was **not** done either —
`webhook-api.md` doesn't currently call this out. The real fix is cursor-based
pagination per activity type; the doc-only fix is a much smaller stopgap if
that's not prioritized soon.

### (e) hooks PUT cannot edit `FeedLog.pauseDuration`

`FeedLog.pauseDuration` (schema comment: "Total session pause in seconds,
same value on all rows of a breastfeed session; null on non-breast rows and
legacy rows") was added by PR #230 and is not referenced anywhere in
`app/api/hooks/v1/babies/[babyId]/activities/[activityId]/route.ts` — it
can't be read or written via the hooks API at all (POST doesn't accept it
either). Adding plain per-row editing would be unsafe: because the same value
is mirrored across both rows of a breastfeed session, an edit to one row
would desync it from its pair. Any fix needs session-aware semantics (update
both rows of the session atomically, or expose it read-only) rather than a
simple field-passthrough. Deferred pending a decision on that semantics, not
attempted as part of this batch's field-wiring work.

### (f) Feedback POST accepts a body `familyId` for support-message attribution

Noted as a deliberate, low-severity deferral in PR #236 and left untouched
here: the feedback/support-message POST endpoint trusts a client-supplied
`familyId` in the request body for attribution, rather than deriving it
solely from `authContext.familyId` per this codebase's usual family-scoping
rule. Low severity because feedback messages are not sensitive family data
and misattribution has no data-access consequence, but it's inconsistent with
the "never trust client-sent family context" rule and should be revisited if
this endpoint's trust model ever changes.

### (g) POST rejects `notes` for pump/measurement while PUT accepts it

Commit `d734ecaf` wires `notes` through for medicine/supplement POST (item
12), and the existing PUT route already accepted `notes` for `PumpLog` and
`Measurement` (both have a `notes` column). POST was deliberately **not**
extended to accept `notes` for those two types, because neither type's
`GET /activities` response currently exposes a `notes` field — accepting it
on POST without a corresponding read would silently reintroduce item 1's
"looks writable, isn't visible" trap. A pump/measurement POST that sends
`notes` today correctly `400`s as an unsupported field (an improvement over
silently dropping it, not a regression). Revisit if pump/measurement GET
responses ever grow a `notes` field — at that point POST should accept it
too, symmetrically with PUT.

Same class of POST/PUT asymmetry shows up again with feed's
`breastMilkAmount`/`startTime`/`endTime`: the hooks PUT route
(`activities/[activityId]/route.ts`) accepts all three for feed updates, but
POST rejects them as unsupported fields, and `GET /activities` never returns
`breastMilkAmount` at all regardless of how the row was created. Revisit
together with the pump/measurement `notes` case above — same underlying
question of which fields should be POST-writable given what GET actually
exposes.

### (h) Remaining item 9 documentation gaps

`webhook-api.md` was updated alongside every fix commit in this batch, but
two bullets from the original item 9 were not specifically re-verified as
part of this pass and may still need attention:

- Whether `lastActivities.sleep.type` (the field carrying `NAP` vs.
  `NIGHT_SLEEP`, needed to label an in-progress sleep correctly) is
  documented in `webhook-api.md`'s `GET /status` section.
- Whether the published documentation's example `GET /babies` response still
  contains a real baby UUID/first name from a live instance, or has been
  scrubbed to a placeholder.

Both are quick documentation-only checks, not code changes.
