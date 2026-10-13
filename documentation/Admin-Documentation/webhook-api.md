# Sprout Track -- Webhook API Documentation

**Version:** 1.1
**Base Path:** `/api/hooks/v1`

---

## Overview

The Sprout Track Webhook API allows external services to read and write baby activity data over HTTP. Any service that can make HTTP requests can integrate with it -- Home Assistant, Grafana, Node-RED, n8n, IFTTT, shell scripts, cron jobs, NFC automations, physical buttons, and more.

**Four verbs:**

- **GET** -- Poll Sprout Track for current state, recent activities, and reference data (dashboards, sensors, monitoring)
- **POST** -- Push new events into Sprout Track (physical buttons, automations, voice assistants)
- **PUT** -- Correct an existing record (fix an amount, adjust times)
- **DELETE** -- Remove a record logged in error

---

## Authentication

### API Keys

API keys are created and managed by caretakers with the **admin** role in the main app under **Settings > Admin > Integrations**. This is in the main Sprout Track interface, not the Family Manager.

Each key:
- Is scoped to a **family**
- Can optionally be restricted to a **specific baby**
- Has configurable **scopes** (`read`, `write`, or both)
- Can have an optional **expiration date**
- Can be **revoked** at any time

### Key Format

```
st_live_<random_hex_string>
```

Keys are shown **once** at creation time. They are stored as SHA-256 hashes and cannot be retrieved later.

### Usage

Include the key in the `Authorization` header:

```
Authorization: Bearer st_live_your_key_here
```

### HTTPS Requirement

All API requests from public/external networks must use HTTPS. Plain HTTP is allowed from private and local network addresses:

- `localhost` / `127.0.0.0/8` (loopback)
- `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918 private networks)
- `169.254.0.0/16` (link-local)
- `::1`, `fc00::/7`, `fe80::/10` (IPv6 loopback, ULA, and link-local)

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `HTTPS_REQUIRED` | 403 | Request must use HTTPS (except localhost) |
| `UNAUTHORIZED` | 401 | Missing or invalid Authorization header |
| `INVALID_KEY` | 401 | Key not found or wrong format |
| `KEY_REVOKED` | 401 | Key has been revoked |
| `KEY_EXPIRED` | 401 | Key has passed its expiration date |
| `INSUFFICIENT_SCOPE` | 403 | Key lacks the required scope (read or write) |
| `BABY_ACCESS_DENIED` | 403 | Key is restricted to a different baby |
| `BABY_NOT_FOUND` | 404 | Baby ID not found in this family |

---

## Rate Limiting

Limits use a sliding 60-second window, tracked per API key and per HTTP method.

| Method | Default limit |
|--------|---------------|
| GET | 60 requests per minute per key |
| POST / PUT / DELETE | 30 requests per minute per key |
| POST `/activities/batch` | 5 requests per minute per key (up to 100 activities each) |

Batch requests have their own window and don't count against the write limit. The system administrator sets all three limits for the whole server under **Webhook API** in the Family Manager's App Configuration (from 1 to 10,000 requests per minute). Raise them temporarily for a bulk import. Families can't change them. A saved change applies right away on the server that saved it and within a minute on any other instance. The limiter is in-memory, so the counts reset when the server restarts.

Every response includes rate limit headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 57
X-RateLimit-Reset: 1741789200
```

- `X-RateLimit-Remaining` counts the current request, so `0` means the next request in this window will be rejected.
- `X-RateLimit-Reset` is the Unix time (seconds) at which the oldest request in the window expires and a slot frees up.

When exceeded, the API returns `429` with error code `RATE_LIMITED` and a `Retry-After` header giving the number of seconds until a retry will succeed. Clients doing bulk syncs should honor `Retry-After` rather than retrying on a fixed schedule.

---

## Response Format

### Success

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-03-12T15:30:00.000Z",
    "familyId": "abc123",
    "babyId": "def456"
  }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

---

## Endpoints

### GET /babies

List all babies in the family. Respects baby-scoped key restrictions.

```bash
curl -s \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  http://localhost:3000/api/hooks/v1/babies
```

**Response:**

```json
{
  "data": {
    "babies": [
      {
        "id": "6f572439-0914-42d3-8eb1-5144e7cfdc94",
        "firstName": "Jackson",
        "lastName": "Smith",
        "birthDate": "2025-12-01",
        "ageInDays": 101,
        "ageFormatted": "3 months, 11 days",
        "gender": "MALE",
        "feedWarningTime": "03:00",
        "diaperWarningTime": "04:00"
      }
    ]
  }
}
```

---

### GET /babies/:babyId/status

Dashboard snapshot -- last activity per type, daily counts, and overdue warnings.

**Query Parameters:**

| Param | Default | Description |
|-------|---------|-------------|
| `timezone` | server local | IANA timezone (e.g., `America/New_York`, `Europe/London`). Controls which calendar day is used for daily counts. Without this, the server's local timezone is used, which may not match yours. |

```bash
curl -s \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  "http://localhost:3000/api/hooks/v1/babies/BABY_ID/status?timezone=America/Chicago"
```

**Response:**

```json
{
  "data": {
    "baby": {
      "id": "...",
      "firstName": "Jackson",
      "ageInDays": 101
    },
    "lastActivities": {
      "feed": {
        "id": "...",
        "time": "2026-03-12T14:30:00.000Z",
        "minutesAgo": 60,
        "type": "BOTTLE",
        "amount": 4,
        "unitAbbr": "OZ",
        "bottleType": "formula",
        "caretakerName": "Mom"
      },
      "diaper": { "time": "...", "minutesAgo": 45, "type": "WET" },
      "sleep": { "startTime": "...", "endTime": "...", "minutesAgo": 120, "duration": 90, "type": "NAP", "isActive": false },
      "bath": { "time": "...", "minutesAgo": 300, "bathType": "Full Bath" },
      "medicine": { "time": "...", "minutesAgo": 480, "medicineName": "Infant Tylenol" },
      "supplement": { "time": "...", "minutesAgo": 600, "supplementName": "Vitamin D Drops" },
      "pump": { "startTime": "...", "minutesAgo": 200, "duration": 15, "isActive": false }
    },
    "activeFeed": {
      "sessionStartTime": "2026-03-12T15:10:00.000Z",
      "minutesAgo": 8,
      "activeSide": "LEFT",
      "isPaused": false,
      "leftDuration": 480,
      "rightDuration": 0
    },
    "dailyCounts": {
      "date": "2026-03-12",
      "feeds": 6,
      "diapers": 4,
      "diapersByType": { "WET": 3, "DIRTY": 0, "BOTH": 1, "DRY": 0 },
      "sleepMinutes": 180,
      "naps": 2,
      "baths": 1,
      "medicines": 1,
      "supplements": 2
    },
    "warnings": {
      "feedOverdue": false,
      "feedMinutesSinceWarning": null,
      "diaperOverdue": true,
      "diaperMinutesSinceWarning": 15
    }
  }
}
```

Each `lastActivities` field reflects the most recent record of that type (regardless of date) and is `null` if no record exists.

`activeFeed` reflects an in-progress breastfeeding timer session (started from the app or via the API) and is `null` when none is active. `leftDuration`/`rightDuration` are accrued seconds including time currently accruing on the active side.

---

### GET /babies/:babyId/activities

Activity logs with optional filtering and cursor pagination, newest first by default.

**Query Parameters:**

| Param | Default | Description |
|-------|---------|-------------|
| `type` | all | Filter by type: `feed`, `diaper`, `sleep`, `note`, `pump`, `play`, `bath`, `measurement`, `medicine`, `supplement`, `food` |
| `limit` | 10 | Max activities per page, across all requested types (1–200) |
| `since` | 24h ago* | ISO 8601 datetime, inclusive lower bound |
| `until` | none | ISO 8601 datetime, exclusive upper bound |
| `order` | `desc` | `desc` (newest first) or `asc` (oldest first) |
| `cursor` | none | `nextCursor` from the previous page |

\* The 24-hour default only applies when none of `since`, `until` or `cursor` is sent. Send `since` to read further back.

**Pagination.** When more activities match than fit in one page, `hasMore` is `true` and `nextCursor` is set. To get the next page, repeat the request with the same `type`, `since`, `until`, `order` and `limit` plus `cursor=<nextCursor>`. Continue until `hasMore` is `false`, when `nextCursor` is `null`. Pages are ordered by `time`, then activity type, then `id`, so activities with the same timestamp are never skipped or repeated. Rows added or deleted between page requests may be missed or shifted, like any live listing. Treat the cursor as an opaque string. A malformed cursor returns `400 INVALID_CURSOR`, an unparseable `since` or `until` returns `400 INVALID_TIME`, and an `order` other than `asc` or `desc` returns `400 INVALID_ORDER`.

To enumerate a baby's full history in a window (for example, to reconcile a backfill), walk it oldest first:

```bash
curl -s -H "Authorization: Bearer st_live_YOUR_KEY" \
  "http://localhost:3000/api/hooks/v1/babies/BABY_ID/activities?type=feed&since=2025-08-01T00:00:00Z&until=2025-09-01T00:00:00Z&order=asc&limit=200"
# then repeat with &cursor=<data.nextCursor> while data.hasMore is true
```

Each page is one GET request against the read rate limit.

```bash
curl -s \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  "http://localhost:3000/api/hooks/v1/babies/BABY_ID/activities?type=feed&limit=5"
```

**Response:**

```json
{
  "data": {
    "activities": [
      {
        "activityType": "feed",
        "id": "...",
        "time": "2026-03-12T14:30:00.000Z",
        "details": {
          "type": "BOTTLE",
          "amount": 4,
          "unitAbbr": "OZ",
          "bottleType": "formula",
          "side": null,
          "food": null,
          "notes": null,
          "startTime": null,
          "endTime": null,
          "feedDuration": null
        },
        "caretakerName": "Mom"
      }
    ],
    "count": 1,
    "hasMore": false,
    "nextCursor": null
  }
}
```

A `food` activity (from the Food tracker) looks like this. `details.foods` lists every food in the meal with its catalog name, per-food reaction, and per-food `amount`/`unitAbbr`/`enjoyment`; the top-level `hadReaction`/`reactionDescription` summarize the meal (true if any food reacted, with the first reacting food's description):

```json
{
  "activityType": "food",
  "id": "...",
  "time": "2026-03-12T12:00:00.000Z",
  "details": {
    "foods": [
      { "foodId": "...", "name": "Banana", "commonAllergen": false, "hadReaction": false, "reactionDescription": null, "amount": 1.5, "unitAbbr": "TBSP", "enjoyment": "LOVED" },
      { "foodId": "...", "name": "Peanut Butter", "commonAllergen": true, "hadReaction": true, "reactionDescription": "Hives on cheeks", "amount": 0.5, "unitAbbr": "TBSP", "enjoyment": null }
    ],
    "amount": 2,
    "unitAbbr": "TBSP",
    "enjoyment": "LIKED",
    "hadReaction": true,
    "reactionDescription": "Hives on cheeks",
    "notes": null
  },
  "caretakerName": "Mom"
}
```

The per-food `amount`/`unitAbbr`/`enjoyment` are what was stored for that food, and `null` when the food has none of its own. Then the meal-level field applies: the meal `enjoyment` covers every food without its own, and the meal `amount` belongs to a food only when it is the meal's only food (a shared amount is never split). Entries logged before per-food details existed, or with a single food, usually carry only the meal-level fields. When the foods have amounts in different units, the meal `amount` and `unitAbbr` are `null`; add up the per-food amounts per unit instead.

---

### POST /babies/:babyId/activities

Create a new activity record.

**Common fields (all activity types):**

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Activity type (see below) |
| `time` | No | ISO 8601 timestamp, defaults to now |
| `caretakerName` | No | Matched against existing caretakers by name |
| `externalId` | No | Your own ID for this entry, up to 255 characters. Makes the request safe to retry (see below) |

**Idempotent writes with `externalId`.** When `externalId` is sent, Sprout Track remembers which activity it created for that ID. Sending the same `externalId` again for the same `type` doesn't create another activity: the response is `200` with `{ "activityType": "...", "id": "<original id>", "duplicate": true }`. IDs are unique per family and activity type, so prefix them with your integration's name if several integrations write to one family (e.g. `"nara:1234"`). The ID stays claimed even if the activity is later deleted in the app, so a re-sync doesn't bring back entries someone deleted. If a request fails, the ID isn't used, and you can retry it with a corrected payload. While another request with the same ID is still running, the API returns `409 EXTERNAL_ID_IN_PROGRESS`. `externalId` only applies to completed entries. It's rejected with `400 INVALID_EXTERNAL_ID` on timer actions (`start`, `end`, `switch`, `pause`, `resume`), or when it isn't a non-empty string of at most 255 characters.

**Unknown fields are rejected.** Each activity type has a fixed set of accepted fields (documented per type below, plus the common fields above). Sending a field the type doesn't recognize returns `400 INVALID_FIELD` listing the offending field name(s), instead of silently accepting and dropping it. This also applies to `caretakerName`: a name that doesn't match any of the family's caretakers now returns `400 CARETAKER_NOT_FOUND` with the list of available caretaker names, rather than creating the activity unattributed.

**Common POST error codes (all activity types):**

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_FIELD` | 400 | Body includes a field not accepted by the activity `type`, or a boolean field (`blowout`, `creamApplied`, `soapUsed`, `shampooUsed`) was sent as a non-boolean value |
| `CARETAKER_NOT_FOUND` | 400 | `caretakerName` was sent but doesn't match any caretaker in the family; the message lists available names |
| `INVALID_AMOUNT` | 400 | A numeric amount field (`amount`, `leftAmount`, `rightAmount`, `totalAmount`) is non-numeric, or a required amount (medicine/supplement `amount`) is missing/null |
| `INVALID_UNIT` | 400 | `unitAbbr` (feed, pump, medicine, supplement) doesn't match any unit configured for your family; the message lists available `unitAbbr` values. Matching is case-insensitive — `"oz"` resolves to the stored `"OZ"` |

**Validated enum-like fields:** `diaper.condition`, `diaper.color`, `sleep.quality`, `feed.bottleType`, and `feed.side` are matched case-insensitively against a canonical set and stored using that set's exact casing — sending `"loose"` stores `"LOOSE"`. An unrecognized value returns `400` naming the field's error code (`INVALID_CONDITION`, `INVALID_COLOR`, `INVALID_QUALITY`, `INVALID_BOTTLE_TYPE`, `INVALID_SIDE`) with the valid values listed. `bath.bathType` is normalized the same way for its known values, but an unrecognized `bathType` is accepted verbatim rather than rejected — the app supports free-text custom bath types. Use `GET /reference` (below) to discover every one of these sets, plus the family's configured units, ahead of time.

#### Feed

```json
{
  "type": "feed",
  "feedType": "formula",
  "amount": 4,
  "unitAbbr": "OZ"
}
```

**feedType values:**

| Value | Effect |
|-------|--------|
| `BREAST` | Breastfeeding |
| `BOTTLE` | Bottle (set `bottleType` separately) |
| `SOLIDS` | Solid food (legacy -- stored as a food entry; use the [`food`](#food) activity type instead; see [Legacy SOLIDS feeds](#legacy-solids-feeds)) |
| `formula` | Auto-sets BOTTLE + bottleType "Formula" |
| `breast milk` | Auto-sets BOTTLE + bottleType "Breast Milk" |
| `milk` | Auto-sets BOTTLE + bottleType "Milk" |
| `other` | Auto-sets BOTTLE + bottleType "Other" |

Optional fields: `amount`, `unitAbbr`, `side`, `food`, `notes`, `bottleType`

`amount` distinguishes an explicit `0` (stored as `0`) from an omitted value (stored as `null`). A non-numeric `amount` returns `400 INVALID_AMOUNT`.

**`side` values:** `LEFT`, `RIGHT` (case-insensitive; stored as the exact uppercase token). An unrecognized value returns `400 INVALID_SIDE`.

**`bottleType` values:** `Formula`, `Breast Milk`, `Formula/Breast`, `Milk`, `Other` (case-insensitive; stored using this exact casing). An unrecognized value returns `400 INVALID_BOTTLE_TYPE`.

`unitAbbr` is matched case-insensitively against your family's configured units (see `GET /reference?type=units`) and stored using that table's exact casing (e.g. `"oz"` is accepted and stored as `"OZ"`). An unrecognized value returns `400 INVALID_UNIT` listing the units actually configured.

**Log a completed breastfeed with known duration:**
```json
{
  "type": "feed",
  "feedType": "BREAST",
  "side": "LEFT",
  "duration": 15
}
```

`duration` is in minutes (matching sleep and pump). The entry is created with `startTime = time`, `endTime = time + duration`, and `feedDuration` (seconds), so it appears as a timed feed in the app.

##### Breastfeeding timer (start/stop)

Breastfeeds also support timer actions backed by the same live session as the in-app timer — a feed started via the API shows as active in the app (and vice versa), and can be controlled from either surface.

**Start a session (requires `side`):**
```json
{
  "type": "feed",
  "feedType": "BREAST",
  "action": "start",
  "side": "LEFT"
}
```

**Switch sides / pause / resume the active session:**
```json
{ "type": "feed", "feedType": "BREAST", "action": "switch" }
{ "type": "feed", "feedType": "BREAST", "action": "pause" }
{ "type": "feed", "feedType": "BREAST", "action": "resume", "side": "RIGHT" }
```

`resume` optionally accepts a `side`; without it the previously active side resumes.

**End the session:**
```json
{
  "type": "feed",
  "feedType": "BREAST",
  "action": "end"
}
```

Ending creates one `FeedLog` per side that accrued time, linked by a shared `sessionId` so they count as one nursing session, and returns the created log ids and durations. The rows carry real sequential spans: the side used first starts at the session start, and the other side starts where the first ended plus any paused time, so each row's `startTime`/`endTime`/`feedDuration` (seconds) reflects when that side was actually in use. Each row also records `pauseDuration` -- the session's total paused seconds (same value on both rows; `null` on records created before this field existed).

**action:** `start`, `switch`, `pause`, `resume`, `end`, or `log` (default when omitted)

Timer action responses include the live session state: `activeSide`, `isPaused`, `leftDuration`/`rightDuration` (seconds), and `isActive`.

**Feed-specific error codes:**

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_ACTION` | 400 | Unknown action, or a timer action used with a non-BREAST feedType |
| `SIDE_REQUIRED` | 400 | `action: "start"` without a LEFT/RIGHT side |
| `FEED_ALREADY_ACTIVE` | 409 | `start` while a session is already active for this baby |
| `NO_ACTIVE_FEED` | 400 | `switch`/`pause`/`resume`/`end` with no active session |
| `INVALID_DURATION` | 400 | `duration` is not a positive number of minutes |

##### Legacy SOLIDS feeds

A `feed` with `feedType: "SOLIDS"` is **stored as a food entry** (a Food tracker log), not as a feed, and the response is a `food` activity (`"activityType": "food"`, same `details` as [`food`](#food)). Older integrations keep working unchanged, but the returned `id` is a food log ID: read it with `GET /activities?type=food` and edit or delete it with `type: "food"`. Like other food entries, it doesn't send feed notifications, and it only resets the "time since last feed" timer when the baby's feed timer settings include food.

The feed fields are mapped the way the server's startup conversion of old SOLIDS feeds maps them:

| Feed field | Food entry |
|------------|------------|
| `food` | One food, matched case-insensitively against the family's food catalog (added when unknown). The text is not split, so `"carrot, peas"` is one food. Blank or omitted becomes the generic `Solids` food. |
| `amount`, `unitAbbr` | The food amount and unit. A non-numeric `amount` returns `400 INVALID_AMOUNT`; `0` or a negative amount is not stored, and neither is its unit. An amount without a unit gets the family's default solids unit. |
| `notes`, `time`, `caretakerName` | Stored as-is (`notes` must be a string). |
| `side`, `bottleType`, `duration` | Ignored (they don't apply to solids). |

**Re-sending is safe.** If the baby already has a (non-deleted) food entry at exactly the same `time` with the same food (case, extra spaces and leading/trailing punctuation ignored), no new entry is created: the response is `200` with the existing entry and `"duplicate": true`. This keeps a client that re-syncs the same SOLIDS feed from logging it twice. The startup conversion applies the same check to SOLIDS feeds still in the database. `type: "food"` requests are never deduplicated.

`PUT` with `type: "feed"` still edits a legacy SOLIDS feed that hasn't been converted yet (or changes a feed to `feedType: "SOLIDS"`). Such feeds are converted into food entries, and the feed deleted, the next time the server starts.

#### Diaper

```json
{
  "type": "diaper",
  "diaperType": "WET",
  "notes": "Slight rash"
}
```

**diaperType:** `WET`, `DIRTY`, `BOTH`, or `DRY` (`DRY` records a change with no contents)

Optional fields: `condition`, `color`, `blowout` (boolean), `creamApplied` (boolean), `notes`

`blowout` and `creamApplied` both default to `false` when omitted. If sent, the value must be a real JSON boolean (`true`/`false`) — a truthy-but-not-boolean value (e.g. the string `"true"`, `1`) returns `400`. `creamApplied` is also included in the `GET /activities` response for diaper entries.

**`condition` values:** `NORMAL`, `LOOSE`, `FIRM`, `OTHER` (case-insensitive; stored using this exact casing — sending `"loose"` stores `"LOOSE"`). An unrecognized value returns `400 INVALID_CONDITION`.

**`color` values:** `YELLOW`, `BROWN`, `GREEN`, `BLACK`, `RED`, `OTHER` (case-insensitive; stored using this exact casing). An unrecognized value returns `400 INVALID_COLOR`.

#### Sleep

Sleep supports three actions:

**Start a sleep session:**
```json
{
  "type": "sleep",
  "sleepType": "NAP",
  "action": "start",
  "location": "Crib"
}
```

**End the most recent active sleep:**
```json
{
  "type": "sleep",
  "action": "end"
}
```

**End and change the sleep type (e.g., a nap that became a night sleep):**
```json
{
  "type": "sleep",
  "sleepType": "NIGHT_SLEEP",
  "action": "end"
}
```

**Log a completed sleep with known duration:**
```json
{
  "type": "sleep",
  "sleepType": "NAP",
  "action": "log",
  "duration": 45,
  "location": "Crib",
  "notes": "Slept peacefully"
}
```

**sleepType:** `NAP` or `NIGHT_SLEEP` -- required for `start` and `log`, optional for `end`
**action:** `start`, `end`, or `log`
Optional fields: `location`, `quality`, `duration` (minutes, required for `log`), `notes`

**`quality` values:** `POOR`, `FAIR`, `GOOD`, `EXCELLENT` (case-insensitive; stored using this exact casing). An unrecognized value returns `400 INVALID_QUALITY`.

> **Note:** If `sleepType` is provided on `end`, the sleep record's type is updated. If omitted, the type from `start` is preserved.

#### Note

```json
{
  "type": "note",
  "content": "First smile today!",
  "category": "milestone"
}
```

`content` is required. `category` is optional.

#### Pump

Pump uses the same start/end/log pattern as sleep:

```json
{ "type": "pump", "action": "start" }
```
```json
{ "type": "pump", "action": "end", "leftAmount": 3, "rightAmount": 2, "unitAbbr": "OZ" }
```
```json
{ "type": "pump", "action": "log", "duration": 20, "leftAmount": 3, "rightAmount": 2, "unitAbbr": "OZ" }
```

Optional fields: `leftAmount`, `rightAmount`, `totalAmount`, `unitAbbr`, `pumpAction` (`STORED`, `FED`, or `DISCARDED`; case-insensitive, default `STORED`; an unrecognized value returns `400 INVALID_PUMP_ACTION`)

`totalAmount` is a writable field, not just a derived one: send it alone (without `leftAmount`/`rightAmount`) to record a total without attributing it to either side. If `totalAmount` and one or both sides are sent together, the explicit `totalAmount` wins over the sum of the sides. If only `leftAmount`/`rightAmount` are sent, `totalAmount` is derived as their sum. Explicit `0` on `leftAmount`/`rightAmount`/`totalAmount` is stored as `0` (a genuine empty pump), distinct from omitting the field entirely (stored as `null`, unknown).

`unitAbbr` is matched case-insensitively against your family's configured units and stored using that table's exact casing. An unrecognized value returns `400 INVALID_UNIT` listing the units actually configured.

#### Bath

```json
{
  "type": "bath",
  "bathType": "Sponge Bath",
  "soapUsed": true,
  "shampooUsed": false,
  "notes": "Quick sponge bath"
}
```

All fields optional. `soapUsed` and `shampooUsed` default to `true` when omitted (this is an existing quirk of the underlying schema default, not a new behavior). If either field is sent, it must be a real JSON boolean — a non-boolean value (e.g. the string `"false"`) returns `400`, rather than being silently coerced. `bathType`'s known values (`Full Bath`, `Sponge Bath`, `Wipe Down`) are matched case-insensitively and stored using this exact casing — sending `"sponge bath"` stores `"Sponge Bath"`. Any other value is accepted and stored verbatim, since the app also supports free-text custom bath types.

#### Measurement

```json
{
  "type": "measurement",
  "measurementType": "WEIGHT",
  "value": 18.5,
  "unit": "LB"
}
```

**measurementType:** `WEIGHT`, `HEIGHT`, `HEAD_CIRCUMFERENCE`, or `TEMPERATURE`
`value` is required and must be a finite number (a missing/null `value` returns `400 VALUE_REQUIRED`; a non-numeric `value` returns `400 INVALID_VALUE`). `unit` is optional. `caretakerName`, if provided and resolved, is now attributed to the created measurement and echoed back by `GET /activities` (previously the caretaker link was accepted but silently discarded).

#### Medicine

```json
{
  "type": "medicine",
  "medicineName": "Vitamin D Drops",
  "amount": 1,
  "unitAbbr": "ML"
}
```

`medicineName` must match an active medicine configured for your family. If not found, the error response lists available medicines. Use the reference endpoint to look them up first.

`amount` is required and must be a finite number — a missing, `null`, or non-numeric `amount` returns `400 INVALID_AMOUNT` rather than silently recording a dose of `0` (the underlying `doseAmount` column cannot be null, so previously an omitted amount fabricated a real zero-dose record).

Optional fields: `unitAbbr`, `notes` — `notes` is now persisted and returned by `GET /activities` (previously accepted but silently dropped). If omitted, `unitAbbr` falls back to the medicine's configured unit. `unitAbbr`, when sent, is matched case-insensitively against your family's configured units and stored using that table's exact casing; an unrecognized value returns `400 INVALID_UNIT` listing the units actually configured.

#### Supplement

```json
{
  "type": "supplement",
  "supplementName": "Vitamin D Drops",
  "amount": 1,
  "unitAbbr": "ML"
}
```

`supplementName` must match an active supplement configured for your family. If not found, the error response lists available supplements. Use the reference endpoint (`?type=supplements`) to look them up first.

`amount` is required and must be a finite number — a missing, `null`, or non-numeric `amount` returns `400 INVALID_AMOUNT` rather than silently recording a dose of `0` (the underlying `doseAmount` column cannot be null, so previously an omitted amount fabricated a real zero-dose record).

Optional fields: `unitAbbr`, `notes` — `notes` is now persisted and returned by `GET /activities` (previously accepted but silently dropped). If omitted, `unitAbbr` falls back to the medicine's configured unit. `unitAbbr`, when sent, is matched case-insensitively against your family's configured units and stored using that table's exact casing; an unrecognized value returns `400 INVALID_UNIT` listing the units actually configured.

#### Food

Logs a meal in the Food tracker, exactly as the app's "Log Food" form does. Use this instead of `feed` with `feedType: "SOLIDS"`, which is also stored as a food entry but supports only one food and no reactions or enjoyment (see [Legacy SOLIDS feeds](#legacy-solids-feeds)).

**One food** -- by name or by catalog ID:

```json
{
  "type": "food",
  "foodName": "Banana",
  "amount": 2,
  "unitAbbr": "TBSP",
  "enjoyment": "LIKED"
}
```

**A meal with several foods** -- each entry is a name string or an object with `foodId` or `name`, plus optional per-food `hadReaction`/`reactionDescription` and `amount`/`unitAbbr`/`enjoyment`:

```json
{
  "type": "food",
  "foods": [
    "Banana",
    { "name": "Peanut Butter", "hadReaction": true, "reactionDescription": "Hives on cheeks", "amount": 0.5, "unitAbbr": "TBSP" },
    { "foodId": "FOOD_ID", "amount": 1, "unitAbbr": "TBSP", "enjoyment": "DISLIKED" }
  ],
  "enjoyment": "LOVED",
  "notes": "First time trying peanut"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `foodName` / `foodId` | One of these, or `foods` | A single food. `foodName` is matched case-insensitively against the family's food catalog; an unknown name is added to the catalog (the same way the app's form adds a new food). `foodId` must be a catalog food from `GET /reference?type=foods`. |
| `hadReaction`, `reactionDescription` | No | Reaction to the single food. Use these only with `foodName`/`foodId`; with `foods[]`, set them on each entry instead. |
| `foods` | One of these, or `foodName`/`foodId` | Non-empty array for a multi-food meal. If the same food appears twice, the entries are merged (it reacted if either entry did; the first `amount`/`unitAbbr` and `enjoyment` sent win). |
| `foods[].amount`, `foods[].unitAbbr`, `foods[].enjoyment` | No | How much of this food was eaten and how much the baby liked it, validated like the meal-level fields below (`amount` positive; `unitAbbr` a configured unit, only with an `amount`, else the family's default solids unit; `enjoyment` one of the five values, case-insensitive) and by the same rules as the app's food-log API. When any food has an `amount`, the meal `amount`/`unitAbbr` are derived from them, as in the app, and the top-level `amount`/`unitAbbr` are ignored (though still validated): the sum when all foods use one unit, `null` when the units differ. The top-level `enjoyment` stays the meal's overall enjoyment. |
| `amount` | No | Amount eaten, positive number |
| `unitAbbr` | No | Unit for `amount` (validated against `GET /reference?type=units`, case-insensitive). Only valid with an `amount`. If you send an `amount` without a unit, the family's default solids unit (Settings, default `TBSP`) is used, as the app does. |
| `enjoyment` | No | `HATED`, `DISLIKED`, `NEUTRAL`, `LIKED`, or `LOVED` (case-insensitive; also listed by `GET /reference?type=food-enjoyments`) |
| `notes` | No | Free text |

The meal-level `hadReaction`/`reactionDescription` stored on the log are derived from the foods, as in the app: `true` if any food reacted, with the first reacting food's description. A `reactionDescription` without `hadReaction: true` is rejected. There is no separate reaction "cause" field. Each food is its own reaction source.

| Code | Status | Description |
|------|--------|-------------|
| `FOOD_REQUIRED` | 400 | None of `foodName`, `foodId`, or `foods` was sent |
| `INVALID_FOOD` | 400 | Food fields are malformed (both `foods` and `foodName`/`foodId`, an empty name, an entry with both or neither of `foodId`/`name`, a non-boolean `hadReaction`, a description without a reaction, an invalid per-food `amount`/`enjoyment`, a per-food `unitAbbr` without an `amount`, ...) |
| `FOOD_NOT_FOUND` | 404 | A `foodId` isn't a (non-deleted) food in this family's catalog. Nothing is written. |
| `INVALID_AMOUNT` | 400 | `amount` isn't a positive number |
| `INVALID_UNIT` | 400 | `unitAbbr` (meal-level or in a `foods[]` entry) isn't a configured unit, or the meal-level `unitAbbr` was sent without an `amount` |
| `INVALID_ENJOYMENT` | 400 | `enjoyment` isn't one of the five values |

New catalog foods are created only after every other field has been validated, so a rejected request never leaves partial catalog entries behind. The response `details` use the same shape as `GET /activities` (see above).

#### Play

```json
{
  "type": "play",
  "playType": "TUMMY_TIME",
  "duration": 15,
  "notes": "Really enjoyed it today"
}
```

**playType:** `TUMMY_TIME`, `INDOOR_PLAY`, `OUTDOOR_PLAY`, `WALK`, or `CUSTOM`
Optional fields: `duration` (minutes), `notes`, `activities` (sub-category string)

---

### POST /babies/:babyId/activities/batch

Create up to 100 activities in one request, for bulk imports and backfills. Requires the `write` scope.

```bash
curl -s -X POST \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "activities": [
      { "type": "feed", "time": "2025-08-01T08:00:00Z", "feedType": "formula", "amount": 4, "unitAbbr": "OZ", "externalId": "nara:feed:1001" },
      { "type": "diaper", "time": "2025-08-01T08:30:00Z", "diaperType": "WET", "externalId": "nara:diaper:2001" },
      { "type": "sleep", "time": "2025-08-01T09:00:00Z", "action": "log", "sleepType": "NAP", "duration": 45, "externalId": "nara:sleep:3001" }
    ]
  }' \
  "http://localhost:3000/api/hooks/v1/babies/BABY_ID/activities/batch"
```

Each item takes the same fields as `POST /activities`, with these differences:

- **Completed entries only.** Timer actions (`start`, `end`, `switch`, `pause`, `resume`) are rejected for that item with `INVALID_ACTION`. Send sleeps and pumps with `"action": "log"` and a `duration`, and timed breastfeeds with a `duration`.
- **No notifications.** Batch entries are treated as history: they never send push notifications and never reset the "time since last" notification timers. The app's timers still reflect the newest entry, as usual.
- **Items are independent.** They're created one at a time, in order. A failed item doesn't stop the rest, and nothing is rolled back.

Use `externalId` on every item so that a retried or re-run batch skips what was already imported.

**Response:** `200` whenever the batch itself is well formed, with one result per item in request order:

```json
{
  "success": true,
  "data": {
    "results": [
      { "index": 0, "success": true, "data": { "activityType": "feed", "id": "...", "time": "2025-08-01T08:00:00.000Z", "details": { "type": "BOTTLE", "amount": 4, "unitAbbr": "OZ", "bottleType": "Formula", "side": null, "food": null } } },
      { "index": 1, "success": true, "data": { "activityType": "diaper", "id": "...", "duplicate": true } },
      { "index": 2, "success": false, "error": { "code": "INVALID_SLEEP_TYPE", "message": "sleepType must be NAP or NIGHT_SLEEP" } }
    ],
    "created": 1,
    "duplicates": 1,
    "failed": 1
  }
}
```

An item's `error` uses the same codes as `POST /activities`, plus `INVALID_ITEM` when the item isn't a JSON object. The request as a whole fails only for `400 INVALID_JSON`, `400 INVALID_BATCH` (`activities` missing, empty, or longer than 100), the usual authentication errors, or `429` when the batch rate limit is exceeded.

---

### PUT /babies/:babyId/activities/:activityId

Edit an existing activity record through API-key auth.

`type` is required in the JSON body so the hooks route can validate fields against the correct activity model. Only fields valid for that activity type are accepted; `familyId`, `babyId`, and `caretakerId` cannot be reassigned through this endpoint.

The same enum-like field validation and normalization described under `POST /activities` above applies here: `condition`, `color`, `quality`, `bottleType`, `side`, and `unitAbbr` are validated and normalized to their canonical casing on update too, with the same error codes.

For `sleep`, sending `endTime` without `duration` recomputes `duration` (whole minutes) from the effective start time (the `startTime` in the same request, or the record's existing `startTime` otherwise); an `endTime` before that start returns `400`, and an explicit `duration` in the request always takes precedence over the recompute.

For `medicine`/`supplement`, an explicit `null` for `amount` or `doseAmount` returns `400` rather than silently recording a zero dose (the underlying `doseAmount` column cannot be null).

For `feed`, `duration` (or `feedDuration`) is in minutes, matching POST -- it is stored as `feedDuration` in seconds.

For `food`, the fields are the same as POST (`foodName`/`foodId` or `foods`, `amount`, `unitAbbr`, `enjoyment`, `notes`, `time`). Sending any food field replaces the meal's foods (unknown names are added to the catalog). To change a reaction or a per-food amount/enjoyment, send the food(s) again with the new values; per-food amounts sent this way replace the meal `amount`/`unitAbbr` as on POST. `amount: null` also clears the unit; `unitAbbr` on a log without an amount is rejected; adding an `amount` to a log without a unit applies the family's default solids unit. An unknown `foodId` returns `404 ACTIVITY_NOT_FOUND` with a message naming the food.

**PUT error codes:**

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_ROUTE` | 400 | Missing `babyId`/`activityId` in the path |
| `INVALID_JSON` | 400 | Body is not a JSON object |
| `INVALID_ACTIVITY_TYPE` | 400 | `type` missing or not one of the eleven supported types |
| `INVALID_FIELD` | 400 | Body includes a field the declared `type` doesn't accept |
| `ACTIVITY_NOT_FOUND` | 404 | No matching, non-deleted activity of that type for this baby and family |
| `INVALID_UPDATE` | 400 | A field failed validation (the message names the field), or no mutable field was sent |

```bash
curl -s -X PUT \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"feed","amount":3,"unitAbbr":"OZ","notes":"Corrected amount"}' \
  http://localhost:3000/api/hooks/v1/babies/BABY_ID/activities/ACTIVITY_ID
```

**Supported types:** `feed`, `diaper`, `sleep`, `note`, `pump`, `play`, `bath`, `measurement`, `medicine`, `supplement`, and `food`.

The response includes `activityType`, `id`, `babyId`, `time` when applicable, `status: "updated"`, and type-specific confirmation details.

### DELETE /babies/:babyId/activities/:activityId

Delete an existing activity record through API-key auth.

```bash
curl -s -X DELETE \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  http://localhost:3000/api/hooks/v1/babies/BABY_ID/activities/ACTIVITY_ID
```

The hooks delete endpoint matches the current classic UI log behavior for these activity types: after confirming the row belongs to the API key's family and route baby, it hard-deletes the activity row. The exception is `food`, which is soft-deleted (marked deleted and hidden everywhere) because that is how the app deletes food logs. Add `?type=feed` if you already know the activity type and want to avoid type probing -- `?type=` accepts the same eleven activity type values as PUT. DELETE shares the write rate limit (30 requests/minute by default).

The response includes `activityType`, `id`, `babyId`, `time` when applicable, and `status: "deleted"`.

---

### GET /babies/:babyId/measurements/latest

Returns the most recent measurement of each type.

```bash
curl -s \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  http://localhost:3000/api/hooks/v1/babies/BABY_ID/measurements/latest
```

**Response:**

```json
{
  "data": {
    "measurements": {
      "WEIGHT": { "value": 18.5, "unit": "LB", "date": "2026-03-10", "daysAgo": 2 },
      "HEIGHT": { "value": 27.5, "unit": "IN", "date": "2026-03-01", "daysAgo": 11 },
      "HEAD_CIRCUMFERENCE": null,
      "TEMPERATURE": { "value": 98.6, "unit": "°F", "date": "2026-03-12", "daysAgo": 0 }
    }
  }
}
```

---

### GET /babies/:babyId/reference

Returns valid values for use with POST endpoints. Use this to discover medicines, sleep locations, play categories, feed types, the family's food catalog, the enum-like field values validated by POST/PUT, and the family's configured units before creating activities.

**Query Parameters:**

| Param | Default | Description |
|-------|---------|-------------|
| `type` | all | `medicines`, `supplements`, `sleep-locations`, `play-categories`, `feed-types`, `diaper-conditions`, `diaper-colors`, `sleep-qualities`, `bath-types`, `units`, `foods`, or `food-enjoyments` |
| `playType` | -- | Filter play categories by play type |

```bash
curl -s \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  "http://localhost:3000/api/hooks/v1/babies/BABY_ID/reference?type=medicines"
```

**Response (all types):**

```json
{
  "data": {
    "medicines": [
      { "id": "...", "name": "Infant Tylenol", "typicalDoseSize": 1.25, "unitAbbr": "ML", "isSupplement": false }
    ],
    "supplements": [
      { "id": "...", "name": "Vitamin D Drops", "typicalDoseSize": 1, "unitAbbr": "ML", "isSupplement": true }
    ],
    "sleepLocations": ["Bassinet", "Stroller", "Crib", "Car Seat", "Parents Room", "Contact", "Other"],
    "playCategories": ["Blocks", "Reading", "Sensory Play"],
    "feedTypes": [
      { "value": "BREAST", "description": "Breastfeeding" },
      { "value": "BOTTLE", "description": "Bottle (specify bottleType separately)" },
      { "value": "SOLIDS", "description": "Solid food (legacy; prefer activity type \"food\")" },
      { "value": "formula", "description": "Formula bottle (auto-sets BOTTLE + formula)" },
      { "value": "breast milk", "description": "Pumped breast milk bottle" },
      { "value": "milk", "description": "Milk bottle" },
      { "value": "other", "description": "Other bottle type" }
    ],
    "diaperConditions": ["NORMAL", "LOOSE", "FIRM", "OTHER"],
    "diaperColors": ["YELLOW", "BROWN", "GREEN", "BLACK", "RED", "OTHER"],
    "sleepQualities": ["POOR", "FAIR", "GOOD", "EXCELLENT"],
    "bathTypes": ["Full Bath", "Sponge Bath", "Wipe Down"],
    "units": [
      { "unitAbbr": "ML", "unitName": "Milliliters" },
      { "unitAbbr": "OZ", "unitName": "Ounces" }
    ],
    "foods": [
      { "id": "...", "name": "Banana", "commonAllergen": false, "notes": null },
      { "id": "...", "name": "Peanut Butter", "commonAllergen": true, "notes": null }
    ],
    "foodEnjoyments": ["HATED", "DISLIKED", "NEUTRAL", "LIKED", "LOVED"]
  }
}
```

`foods` is the family's food catalog (deleted foods excluded, sorted by name), which is what `POST` type `food` matches `foodName` against and what `foodId` must come from.

`sleepLocations` is deduplicated ignoring case and underscore/space differences, preferring the display-cased variant (e.g. a legacy `CAR_SEAT` value logged before validation existed collapses onto `Car Seat` rather than appearing as a separate duplicate entry). `units` lists every unit configured in the `Unit` table and is the same set `unitAbbr` is validated against on POST/PUT.

---

## Sample Scenarios

### 1. Home Assistant -- Baby Status Sensors

Poll the status endpoint to create sensors for feed time, diaper count, and sleep state.

```yaml
# configuration.yaml
rest:
  - resource: "http://sprout-track:3000/api/hooks/v1/babies/BABY_ID/status?timezone=America/Chicago"
    headers:
      Authorization: "Bearer st_live_YOUR_KEY"
    scan_interval: 60
    sensor:
      - name: "Baby Last Feed"
        value_template: "{{ value_json.data.lastActivities.feed.minutesAgo | default('N/A') }}"
        unit_of_measurement: "min ago"
      - name: "Baby Feed Count Today"
        value_template: "{{ value_json.data.dailyCounts.feeds }}"
      - name: "Baby Diaper Count Today"
        value_template: "{{ value_json.data.dailyCounts.diapers }}"
      - name: "Baby Sleep Minutes Today"
        value_template: "{{ value_json.data.dailyCounts.sleepMinutes }}"
        unit_of_measurement: "min"
      - name: "Baby Feed Overdue"
        value_template: "{{ value_json.data.warnings.feedOverdue }}"
```

### 2. Home Assistant -- Button to Log Formula Feed

Use a physical Zigbee button or dashboard button to log a 4oz formula bottle with one press.

```yaml
# automations.yaml
- alias: "Nursery Button - Log Formula"
  trigger:
    - platform: device
      device_id: nursery_button
      type: action
      subtype: single
  action:
    - service: rest_command.log_formula
      data: {}

# configuration.yaml
rest_command:
  log_formula:
    url: "http://sprout-track:3000/api/hooks/v1/babies/BABY_ID/activities"
    method: POST
    headers:
      Authorization: "Bearer st_live_YOUR_KEY"
      Content-Type: "application/json"
    payload: '{"type":"feed","feedType":"formula","amount":4,"unitAbbr":"OZ"}'
```

### 3. NFC Tag -- Quick Diaper Log

Tap an NFC tag on the changing table to log a wet diaper. Works with iOS Shortcuts or Android Tasker.

```bash
curl -X POST \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"diaper","diaperType":"WET"}' \
  http://sprout-track:3000/api/hooks/v1/babies/BABY_ID/activities
```

### 4. Cron Job -- Daily Summary Script

Run a nightly script that fetches the day's activity counts and sends a summary.

```bash
#!/bin/bash
# daily-summary.sh -- run via cron at 9pm

API_KEY="st_live_YOUR_KEY"
BASE="http://sprout-track:3000/api/hooks/v1"
BABY_ID="YOUR_BABY_ID"
TIMEZONE="America/Chicago"

STATUS=$(curl -s -H "Authorization: Bearer $API_KEY" "$BASE/babies/$BABY_ID/status?timezone=$TIMEZONE")

FEEDS=$(echo "$STATUS" | jq '.data.dailyCounts.feeds')
DIAPERS=$(echo "$STATUS" | jq '.data.dailyCounts.diapers')
SLEEP=$(echo "$STATUS" | jq '.data.dailyCounts.sleepMinutes')
NAPS=$(echo "$STATUS" | jq '.data.dailyCounts.naps')

echo "Daily Summary:"
echo "  Feeds: $FEEDS"
echo "  Diapers: $DIAPERS"
echo "  Sleep: ${SLEEP}min across $NAPS naps"
```

### 5. Grafana Dashboard

Use Grafana's JSON API data source to poll feed and diaper activity over time.

```
GET /api/hooks/v1/babies/BABY_ID/activities?type=feed&limit=50&since=2026-03-05T00:00:00Z
GET /api/hooks/v1/babies/BABY_ID/activities?type=diaper&limit=50&since=2026-03-05T00:00:00Z
```

Each response includes timestamped records that can be plotted on time-series panels.

### 6. Automation -- Feed Overdue Alert

Poll the status endpoint and send a notification when the feed warning triggers.

```bash
#!/bin/bash
# check-feed.sh -- run every 5 minutes via cron

API_KEY="st_live_YOUR_KEY"
BASE="http://sprout-track:3000/api/hooks/v1"
BABY_ID="YOUR_BABY_ID"
TIMEZONE="America/Chicago"

STATUS=$(curl -s -H "Authorization: Bearer $API_KEY" "$BASE/babies/$BABY_ID/status?timezone=$TIMEZONE")
OVERDUE=$(echo "$STATUS" | jq -r '.data.warnings.feedOverdue')

if [ "$OVERDUE" = "true" ]; then
  MINUTES=$(echo "$STATUS" | jq '.data.warnings.feedMinutesSinceWarning')
  # Send notification via your preferred method
  curl -X POST "https://ntfy.sh/your-topic" \
    -d "Feed overdue by ${MINUTES} minutes!"
fi
```

### 7. Sleep Tracking with Start/End

Use two buttons or automations -- one to start, one to end a nap.

**Start nap (when baby goes down):**
```bash
curl -X POST \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"sleep","sleepType":"NAP","action":"start","location":"Crib"}' \
  http://sprout-track:3000/api/hooks/v1/babies/BABY_ID/activities
```

**End nap (when baby wakes):**
```bash
curl -X POST \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"sleep","sleepType":"NAP","action":"end"}' \
  http://sprout-track:3000/api/hooks/v1/babies/BABY_ID/activities
```

The API automatically calculates the duration.

### 8. Medicine & Supplement Administration with Lookup

Medicines and supplements are separate types. Use the reference endpoint to discover what's available, then log a dose.

**Look up medicines:**
```bash
curl -s \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  "http://sprout-track:3000/api/hooks/v1/babies/BABY_ID/reference?type=medicines"
```

**Log a medicine dose:**
```bash
curl -X POST \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"medicine","medicineName":"Infant Tylenol","amount":1.25,"unitAbbr":"ML"}' \
  http://sprout-track:3000/api/hooks/v1/babies/BABY_ID/activities
```

**Look up supplements:**
```bash
curl -s \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  "http://sprout-track:3000/api/hooks/v1/babies/BABY_ID/reference?type=supplements"
```

**Log a supplement dose:**
```bash
curl -X POST \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"supplement","supplementName":"Vitamin D Drops","amount":1,"unitAbbr":"ML"}' \
  http://sprout-track:3000/api/hooks/v1/babies/BABY_ID/activities
```

---

## Testing

An interactive test script is included:

```bash
node scripts/test-webhook-api.js
node scripts/test-webhook-api.js --read-only
node scripts/test-webhook-api.js --write-only
```

The script prompts for your base URL and API key, then runs auth, read, and write tests against a live instance.
