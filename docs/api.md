# API reference

Base URL: `http://localhost:4000`. Every route below is prefixed with `/api` except `/health`.

All requests and responses are JSON. Authenticated routes expect `Authorization: Bearer <token>`.

## Conventions

**Error shape.** Every failure returns the same envelope, so a client has one path for error handling:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Request validation failed",
    "details": [{ "location": "body", "field": "password", "message": "Password must contain a number" }],
    "requestId": "3997ee52-fa45-4c7f-8bbf-c74cf9d7b9ac"
  }
}
```

`requestId` is also returned as the `x-request-id` header and is written on every log line for that request.

**Status codes.** `400` malformed input, `401` missing or invalid token, `403` not your resource, `404` unknown route or record, `409` a rule conflict such as a taken slot or an illegal status transition, `422` schema validation failure, `429` rate limited, `503` the database is unreachable.

**Rate limits.** A sliding window of `RATE_LIMIT_WINDOW_MS` (default 60s): 120 requests per IP globally, 10 per IP on auth routes (successful requests are not counted), 20 per user on chat sends. Limits are reported in `RateLimit-*` headers.

## Health

### `GET /health`

```json
{ "status": "ok", "uptimeSeconds": 512, "aiProvider": "mistral", "checks": { "database": "ok" } }
```

Returns `503` with `"status": "degraded"` when the database does not answer. `aiProvider` is `rule-based-fallback` when no API key is configured.

## Authentication

### `POST /api/auth/signup`

Creates a business and its owner in one transaction.

```json
{ "fullName": "Alex Carter", "email": "alex@example.com", "password": "Password123", "businessName": "Carter Clinic" }
```

`businessName` is optional. Passwords need 8+ characters with an uppercase letter, a lowercase letter and a digit. Responds `201`:

```json
{
  "token": "eyJhbGciOi...",
  "expiresIn": "7d",
  "user": { "id": "1581c51b-...", "email": "alex@example.com", "fullName": "Alex Carter", "role": "owner", "createdAt": "2026-10-03T06:57:18.455Z" },
  "business": { "id": "6c978b09-...", "name": "Carter Clinic", "slug": "carter-clinic-10dcab", "timezone": "UTC", "openingHour": 9, "closingHour": 17, "slotMinutes": 30 }
}
```

`409` when the email is taken.

### `POST /api/auth/login`

```json
{ "email": "demo@schedulr.test", "password": "Password123!" }
```

Same payload as signup. Returns `401 unauthorized` for both an unknown email and a wrong password, and compares against a dummy hash when the user does not exist so the two cases take the same time.

### `GET /api/auth/me`

Returns `{ "user": {...}, "business": {...} }` for the bearer token.

## Chat

### `POST /api/chat/sessions`

Get-or-create the caller's open conversation. A new session is seeded with the signed-in user's name and email and an assistant greeting.

```json
{
  "session": {
    "id": "de5fb0af-...",
    "status": "active",
    "title": null,
    "draft": { "service": null, "date": null, "time": null, "customerName": "Alex Carter", "customerEmail": "alex@example.com", "notes": null },
    "messageCount": 0,
    "lastMessageAt": null,
    "createdAt": "2026-10-03T06:57:18.564Z"
  },
  "messages": [{ "id": "4e6e631b-...", "sessionId": "de5fb0af-...", "sender": "assistant", "content": "Hi Alex, I book appointments for Carter Clinic...", "createdAt": "2026-10-03T06:57:18.565Z", "metadata": { "kind": "greeting" } }]
}
```

### `POST /api/chat/sessions/reset`

Closes the open conversation and returns a fresh one in the same shape. `201`.

### `GET /api/chat/sessions`

`{ "sessions": [ ... ] }`, newest first.

### `GET /api/chat/sessions/:id/messages`

Query: `since` (ISO timestamp, exclusive) and `limit` (1-200, default 100). `since` is the cursor the frontend uses when it falls back to polling.

### `POST /api/chat/sessions/:id/messages`

The REST equivalent of the `chat:send` socket event; both call the same service. Body `{ "content": "I need a consultation tomorrow at 2pm" }`, max 1000 characters. Responds `201` with the whole turn:

```json
{
  "sessionId": "de5fb0af-...",
  "userMessage": { "id": "...", "sender": "user", "content": "I need a consultation tomorrow at 2pm", "createdAt": "...", "metadata": null },
  "assistantMessage": { "id": "...", "sender": "assistant", "content": "Booked Consultation for Sunday 4 October at 14:00 UTC...", "createdAt": "...", "metadata": { "intent": "book_appointment", "source": "mistral", "fields": { "...": "..." }, "missingFields": [], "needsForm": false, "appointmentId": "019077df-..." } },
  "draft": { "service": null, "date": null, "time": null, "customerName": "Alex Carter", "customerEmail": "alex@example.com", "notes": null },
  "missingFields": ["service", "date", "time"],
  "needsForm": false,
  "appointment": { "id": "019077df-...", "service": "Consultation", "scheduledAt": "2026-10-04T14:00:00.000Z", "status": "pending", "...": "..." },
  "assistantSource": "mistral"
}
```

`appointment` is `null` until the five required details are known. `needsForm` turns `true` when details are still missing after three user turns, which is the client's cue to surface the booking form. `assistantSource` is `mistral` or `fallback`, so the UI can show when the rule-based planner answered.

## Appointments

### `GET /api/appointments`

Query: `status` (repeatable), `from` and `to` (`YYYY-MM-DD`), `limit` (1-100, default 50), `offset`. Returns `{ "appointments": [...], "count": 2 }` ordered by `scheduledAt` ascending.

### `GET /api/appointments/summary`

```json
{ "summary": { "pending": 2, "confirmed": 0, "cancelled": 0, "completed": 0, "upcoming": 2, "nextAppointment": { "...": "..." } } }
```

### `POST /api/appointments`

```json
{
  "service": "Dental cleaning",
  "date": "2026-10-06",
  "time": "10:30",
  "customerName": "Jess Lane",
  "customerEmail": "jess@example.com",
  "durationMinutes": 30,
  "notes": "first visit",
  "chatSessionId": "de5fb0af-..."
}
```

`durationMinutes` defaults to 30; `notes` and `chatSessionId` are optional. The slot must be in the future, inside opening hours, on the slot grid and free, otherwise `400` or `409` with `details.issue` set to `in_past`, `outside_hours`, `misaligned` or `slot_taken`. Responds `201` with `{ "appointment": {...} }`.

### `GET /api/appointments/:id`

`{ "appointment": {...} }`, or `404` when the id belongs to another tenant.

### `PATCH /api/appointments/:id`

Any of `status`, `date` + `time` (both required together to reschedule), `durationMinutes`, `notes`. Allowed transitions are `pending → confirmed | cancelled` and `confirmed → completed | cancelled`; anything else is `409`. Rescheduling re-runs the slot checks, excluding the appointment itself.

### `DELETE /api/appointments/:id`

Cancels rather than deletes, so the history stays auditable. Returns the updated appointment.

## Realtime (Socket.IO)

Connect to the API origin with the JWT in the handshake:

```ts
const socket = io("http://localhost:4000", { auth: { token } });
```

A connection without a valid token is rejected. Each socket joins a room for its user, so multiple tabs stay in sync.

| Direction | Event | Payload |
| --- | --- | --- |
| client to server | `chat:send` | `{ content, sessionId? }`, acknowledged with `{ ok: true, turn }` or `{ ok: false, error: { code, message } }` |
| server to client | `chat:message` | One `ChatMessage`, emitted for the user's message and the assistant's reply |
| server to client | `chat:state` | `{ sessionId, draft, missingFields, needsForm, assistantSource }` |
| server to client | `chat:thinking` | `true` before the model call, `false` after |
| server to client | `appointment:created` | The `Appointment` that the conversation produced |
| server to client | `chat:error` | `{ code, message }` |

Sends are rate limited per user with the same window as the REST route. Clients that cannot hold a socket open use `POST /api/chat/sessions/:id/messages` and poll `GET /api/chat/sessions/:id/messages?since=...`.
