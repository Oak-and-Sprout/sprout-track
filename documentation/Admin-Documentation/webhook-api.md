# Sprout Track -- Webhook API Documentation

**Version:** 1.0
**Base Path:** `/api/hooks/v1`

---

## Overview

The Sprout Track Webhook API allows external services to read and write baby activity data over HTTP. Any service that can make HTTP requests can integrate with it -- Home Assistant, Grafana, Node-RED, n8n, IFTTT, shell scripts, cron jobs, NFC automations, physical buttons, and more.

**Two directions of data flow:**

- **GET** -- Poll Sprout Track for current state, recent activities, and reference data (dashboards, sensors, monitoring)
- **POST** -- Push new events into Sprout Track (physical buttons, automations, voice assistants)

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

| Method | Limit |
|--------|-------|
| GET | 60 requests per minute per key |
| POST | 30 requests per minute per key |

Every response includes rate limit headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1741789200
```

When exceeded, the API returns `429` with error code `RATE_LIMITED`.

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

```bash
curl -s \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  http://localhost:3000/api/hooks/v1/babies/BABY_ID/status
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
      "bath": { "time": "...", "minutesAgo": 300 },
      "medicine": { "time": "...", "minutesAgo": 480, "medicineName": "Vitamin D Drops" },
      "pump": { "startTime": "...", "minutesAgo": 200, "duration": 15, "isActive": false }
    },
    "dailyCounts": {
      "date": "2026-03-12",
      "feeds": 6,
      "diapers": 4,
      "diapersByType": { "WET": 3, "DIRTY": 0, "BOTH": 1 },
      "sleepMinutes": 180,
      "naps": 2,
      "baths": 1,
      "medicines": 1
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

Any `lastActivities` field is `null` if no record exists for that type today.

---

### GET /babies/:babyId/activities

Recent activity logs with optional filtering.

**Query Parameters:**

| Param | Default | Description |
|-------|---------|-------------|
| `type` | all | Filter by type: `feed`, `diaper`, `sleep`, `note`, `pump`, `play`, `bath`, `measurement`, `medicine` |
| `limit` | 10 | Max records per type (1–50) |
| `since` | 24h ago | ISO 8601 datetime cutoff |

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
          "notes": null
        },
        "caretakerName": "Mom"
      }
    ],
    "count": 1,
    "hasMore": false
  }
}
```

---

### POST /babies/:babyId/activities

Create a new activity record.

**Common fields (all activity types):**

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Activity type (see below) |
| `time` | No | ISO 8601 timestamp, defaults to now |
| `caretakerName` | No | Matched against existing caretakers by name |

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
| `SOLIDS` | Solid food |
| `formula` | Auto-sets BOTTLE + bottleType "formula" |
| `breast milk` | Auto-sets BOTTLE + bottleType "breast milk" |
| `milk` | Auto-sets BOTTLE + bottleType "milk" |
| `other` | Auto-sets BOTTLE + bottleType "other" |

Optional fields: `amount`, `unitAbbr`, `side` (LEFT/RIGHT/BOTH), `food`, `notes`, `bottleType`

#### Diaper

```json
{
  "type": "diaper",
  "diaperType": "WET"
}
```

**diaperType:** `WET`, `DIRTY`, or `BOTH`

Optional fields: `condition`, `color`, `blowout` (boolean)

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
  "sleepType": "NAP",
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
  "location": "Crib"
}
```

**sleepType:** `NAP` or `NIGHT_SLEEP`
**action:** `start`, `end`, or `log`
Optional fields: `location`, `quality`, `duration` (minutes, required for `log`)

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

Optional fields: `leftAmount`, `rightAmount`, `unitAbbr`, `pumpAction` (STORED/USED/DISCARDED, default STORED)

#### Bath

```json
{
  "type": "bath",
  "soapUsed": true,
  "shampooUsed": false,
  "notes": "Quick sponge bath"
}
```

All fields optional. `soapUsed` and `shampooUsed` default to `true`.

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
`value` is required. `unit` is optional.

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

Optional fields: `amount`, `unitAbbr`, `notes`

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

Returns valid values for use with POST endpoints. Use this to discover medicines, sleep locations, play categories, and feed types before creating activities.

**Query Parameters:**

| Param | Default | Description |
|-------|---------|-------------|
| `type` | all | `medicines`, `sleep-locations`, `play-categories`, or `feed-types` |
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
      { "id": "...", "name": "Vitamin D Drops", "typicalDoseSize": 1, "unitAbbr": "ML", "isSupplement": true },
      { "id": "...", "name": "Infant Tylenol", "typicalDoseSize": 1.25, "unitAbbr": "ML", "isSupplement": false }
    ],
    "sleepLocations": ["Bassinet", "Stroller", "Crib", "Car Seat", "Parents Room", "Contact", "Other"],
    "playCategories": ["Blocks", "Reading", "Sensory Play"],
    "feedTypes": [
      { "value": "BREAST", "description": "Breastfeeding" },
      { "value": "BOTTLE", "description": "Bottle (specify bottleType separately)" },
      { "value": "SOLIDS", "description": "Solid food" },
      { "value": "formula", "description": "Formula bottle (auto-sets BOTTLE + formula)" },
      { "value": "breast milk", "description": "Pumped breast milk bottle" },
      { "value": "milk", "description": "Milk bottle" },
      { "value": "other", "description": "Other bottle type" }
    ]
  }
}
```

---

## Sample Scenarios

### 1. Home Assistant -- Baby Status Sensors

Poll the status endpoint to create sensors for feed time, diaper count, and sleep state.

```yaml
# configuration.yaml
rest:
  - resource: http://sprout-track:3000/api/hooks/v1/babies/BABY_ID/status
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

STATUS=$(curl -s -H "Authorization: Bearer $API_KEY" "$BASE/babies/$BABY_ID/status")

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

STATUS=$(curl -s -H "Authorization: Bearer $API_KEY" "$BASE/babies/$BABY_ID/status")
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

### 8. Medicine Administration with Lookup

First, discover available medicines, then log a dose.

**Look up medicines:**
```bash
curl -s \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  "http://sprout-track:3000/api/hooks/v1/babies/BABY_ID/reference?type=medicines"
```

**Log a dose:**
```bash
curl -X POST \
  -H "Authorization: Bearer st_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"medicine","medicineName":"Vitamin D Drops","amount":1,"unitAbbr":"ML"}' \
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
