# Database design

PostgreSQL 14+. The full DDL is in [`schema.sql`](./schema.sql) and sample rows are in [`seed.sql`](./seed.sql).

```
businesses ──┬──< users ──┬──< chat_sessions ──< chat_messages
             │            │           │
             │            │           └──< ai_interactions
             │            │
             └────────────┴──< appointments >── chat_sessions (optional link)
```

## Tables

| Table | Purpose | Notes |
| --- | --- | --- |
| `businesses` | Tenant record: name, slug, opening hours, slot length | Every tenant-scoped row carries `business_id`, so a tenant's data can be filtered, exported or deleted as a unit |
| `users` | Authentication and profile | `password_hash` only, never a plaintext column; `role` drives row scoping (`customer` sees only its own appointments) |
| `chat_sessions` | One conversation, its status and the booking `draft` | The draft is the conversation memory the AI layer merges into on each turn |
| `chat_messages` | Every turn, including the assistant's | `extracted_data` stores what the AI returned for that turn, which makes a conversation replayable during debugging |
| `appointments` | Scheduling data and lifecycle status | Optional `chat_session_id` records which conversation produced the booking |
| `ai_interactions` | One row per model call | Provider, model, status, token counts, latency and the error message when a call failed |

## Constraints that carry business rules

Keeping these in the database means a second writer (a worker, a script, a future service) cannot bypass them.

- `users_email_normalised` forces lowercase emails so the unique index cannot be defeated by casing.
- `businesses_hours_ordered` keeps `closing_hour > opening_hour`.
- `chat_sessions_closed_at_set` keeps `status` and `closed_at` consistent.
- `chat_sessions_one_active_per_user_idx` is a partial unique index giving each user exactly one open conversation, which is what makes the `INSERT ... ON CONFLICT DO NOTHING` get-or-create in `chat.repository.ts` safe under concurrent requests.
- `appointments_no_double_booking_idx` is a partial unique index on `(business_id, scheduled_at)` for rows in `pending` or `confirmed`. Cancelled and completed rows are excluded, so a cancelled slot frees up again.
- Status transitions (`pending → confirmed → completed`, cancel from either) are enforced in the service layer rather than the database, because the valid transitions are product policy and change more often than the schema.

## Indexing strategy

Each index exists for a query the application actually runs.

| Index | Query it serves |
| --- | --- |
| `users_email_key` (unique) | Login and signup lookups by email |
| `users_business_id_idx` | Listing the staff of a tenant |
| `chat_sessions_one_active_per_user_idx` | Resuming the open conversation on page load |
| `chat_sessions_user_recent_idx` | Conversation history, newest first |
| `chat_messages_session_order_idx` on `(session_id, created_at, id)` | Transcript paging and the `since` cursor used by the polling fallback; the trailing `id` keeps the order total when two rows share a timestamp |
| `appointments_business_calendar_idx` on `(business_id, scheduled_at)` | Calendar and date-range queries |
| `appointments_open_queue_idx`, partial on open statuses | The dashboard list and the summary counters, which only care about pending and confirmed rows |
| `appointments_user_recent_idx` | A customer's own bookings |
| `appointments_chat_session_idx`, partial on not-null | Tracing a booking back to its conversation |
| `ai_interactions_session_idx` | Replaying the model calls of one conversation |
| `ai_interactions_failures_idx`, partial on `status <> 'success'` | Error-rate dashboards without scanning the successful rows, which dominate the table |

Partial indexes are used wherever queries only look at a subset of rows. They stay small, so they stay in cache, and they skip maintenance work on rows nobody queries that way.

## Performance considerations

- **Composite column order follows the access pattern.** `(business_id, scheduled_at)` serves both "this tenant" and "this tenant in this window"; the reverse order would serve neither well.
- **Lists are keyset-friendly.** Transcripts page on `(session_id, created_at, id)`, so cursor paging stays O(log n) instead of degrading the way `OFFSET` does on large tables.
- **Counters avoid repeated aggregation.** `chat_sessions.message_count` and `last_message_at` are maintained in the same transaction as the insert, so rendering a session list does not aggregate `chat_messages`.
- **`ai_interactions` is the growth table.** It gets one row per model call with JSONB payloads. In production it would be partitioned by month with a retention policy, and the payloads trimmed; the schema keeps it free of foreign-key dependents other than the session so partitioning stays straightforward.
- **Connection pooling is bounded** (`DATABASE_POOL_MAX`, default 10) because serverless and container platforms multiply connections quickly; a shared pooler such as PgBouncer would sit in front of a real deployment.
- **Slow queries are logged** above 300 ms in `backend/src/config/database.ts`, which is where an index is usually found to be missing.
- **`business_daily_load`** is a plain view for per-day load. If it became a hot dashboard query it would be a materialised view refreshed on a schedule rather than computed per request.

## Multi-tenancy

`business_id` is on every tenant-owned table, and every query in the repositories filters on it, taking the value from the JWT rather than from user input. Appointment uniqueness is scoped per business, so two tenants can hold the same slot.

The next step for a production system would be PostgreSQL row-level security: a per-request `SET LOCAL app.business_id`, then policies such as `USING (business_id = current_setting('app.business_id')::uuid)`. That turns tenant isolation into a database guarantee instead of a convention the application has to remember.

## Known simplifications

- All times are stored as `timestamptz` but interpreted as UTC end to end. `businesses.timezone` exists for the real implementation, which would convert using the tenant's zone.
- One bookable resource per business. Multiple staff calendars would need a `resources` table with appointments referencing it, and the double-booking index extended to `(resource_id, scheduled_at)`.
- Overlap is checked in the service layer with a range comparison, while the index only prevents identical start times. A production schema would use `btree_gist` and an exclusion constraint on `tstzrange(scheduled_at, scheduled_at + duration)` to push overlap protection into the database.
