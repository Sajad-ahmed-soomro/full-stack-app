# Schedulr

An appointment-booking SaaS prototype where customers book by chatting with an AI assistant. A Next.js frontend talks to an Express API over REST and Socket.IO; the API extracts booking details from the conversation with Mistral, validates them against the business rules, and writes appointments to PostgreSQL.

## Live demo

| | |
| --- | --- |
| Application | **https://frontend-seven-smoky-45.vercel.app** |
| API | https://full-stack-app-esp3.onrender.com (`/health`, `/api` lists the routes) |
| Demo account | **demo@schedulr.test** / **Password123!** (the sign-in screen has a button that fills it in) |

Both services are on free tiers that sleep when idle, so the first request after a quiet period takes up to a minute while the API and database wake. A refresh is enough.

- API reference: [`docs/api.md`](./docs/api.md)
- Database design: [`database/README.md`](./database/README.md)
- Running locally: [below](#running-locally)

## What it does

1. Sign up, which creates a business (the tenant) and its owner account, or sign in.
2. Chat with the assistant: "I need a consultation tomorrow at 2pm". It accumulates the five details a booking needs (service, date, time, customer name, customer email) across turns and shows what it has captured.
3. Once the details are complete, the API validates the slot and books it. Replies stay conversational when a rule is broken: "Sunday 4 October at 14:00 is already booked. Try another time."
4. If details are still missing after a few turns, or the model is unavailable, the UI offers a structured booking form prefilled with whatever the conversation already captured.
5. The appointment list updates in real time, with confirm, complete and cancel actions.

## Architecture

```
┌──────────────────────────────┐        ┌────────────────────────────────────────────┐
│ Next.js 16 (App Router)      │  REST  │ Express API                                │
│                              │ ─────► │                                            │
│  app/            routes      │        │  middleware   logging, rate limit,         │
│  components/     UI          │ ◄───── │               JWT auth, zod validation,    │
│  lib/            api client, │  JSON  │               error handler                │
│                  auth ctx,   │        │  modules/auth         signup, login, me    │
│                  useChat,    │  WS    │  modules/chat         orchestrates a turn   │
│                  useAppts    │ ◄────► │  modules/appointments booking rules        │
└──────────────────────────────┘        │  modules/ai           provider + guardrails │
                                        └──────────┬───────────────────┬─────────────┘
                                                   │                   │
                                          ┌────────▼────────┐  ┌───────▼────────┐
                                          │ PostgreSQL      │  │ Mistral API    │
                                          │ 6 tables + view │  │ JSON mode      │
                                          └─────────────────┘  └────────────────┘
```

Each backend module is split the same way: `*.routes.ts` wires HTTP, `*.controller.ts` reads the request and writes the response, `*.service.ts` holds the rules, `*.repository.ts` owns the SQL, `*.schemas.ts` holds the zod schemas that also produce the request types.

**What happens on one chat turn** (`backend/src/modules/chat/chat.service.ts`):

1. Resolve the caller's open session, load the business config and the recent turns.
2. Persist the user's message first, so a provider failure never loses it.
3. Ask the AI layer for a plan: a reply plus the booking fields it could extract.
4. Sanitise and merge those fields into the session draft, then re-derive whether the booking is complete. The model's own completeness claim is never trusted.
5. If complete, call the appointment service, which applies the slot rules and writes the row.
6. Persist the assistant's reply with what was extracted, update the draft, broadcast the turn to the user's sockets.

The AI layer never writes to the database and never decides whether a booking is legal. It turns prose into candidate fields; the appointment service decides.

## Tech choices

| Area | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js 16, React 19, Tailwind v4 | App Router for routing and build tooling; the app itself is client-rendered because every view is behind auth and driven by a socket |
| State | React Context for auth, `useReducer` hooks for chat and appointments | Two scopes of state and a handful of transitions; a store library would add indirection without removing any |
| Backend | Express 4 + TypeScript | The brief's default, and the middleware chain maps directly onto the required cross-cutting concerns |
| Validation | zod | One schema per request produces both the runtime check and the TypeScript type, so the controller signature cannot drift from what is validated |
| Database access | `pg` with hand-written SQL | The schema is a deliverable; keeping the queries in SQL keeps what runs close to what is documented, and makes the index strategy legible |
| Auth | JWT, bcrypt | Stateless, and the token also authenticates the socket handshake |
| Realtime | Socket.IO | Automatic reconnection and acknowledgements; the client degrades to REST plus polling when the socket cannot connect |
| AI | Mistral `mistral-small-latest` in JSON mode | Free tier, fast, and structured output removes the need to parse prose |
| Logging | pino | Structured JSON with a request id per line, and redaction for tokens and passwords |

## Running locally

### Prerequisites

Node 20+, PostgreSQL 14+ (or Docker). A Mistral API key is optional; without one the assistant falls back to the deterministic planner described below and everything else still works.

### Option 1: Docker Compose

```bash
cp backend/.env.example backend/.env       # only MISTRAL_API_KEY is worth editing
docker compose up --build
docker compose exec api node scripts/seed.mjs   # optional demo data
```

Frontend on `:3000`, API on `:4000`, PostgreSQL on `:5432`. The API container runs the migration on start.

### Option 2: Run the two apps directly

```bash
# 1. database
createdb schedulr

# 2. API
cd backend
cp .env.example .env
# set DATABASE_URL and JWT_SECRET (32+ characters); add MISTRAL_API_KEY if you have one
npm install
npm run db:migrate          # applies database/schema.sql
npm run db:seed             # optional: two businesses, three users, four appointments
npm run dev                 # http://localhost:4000

# 3. frontend, in another terminal
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

Then open `http://localhost:3000`, sign in with the demo account (the login screen has a button that fills it in), or create a new account to start with an empty workspace.

### Useful scripts

| Command | Location | What it does |
| --- | --- | --- |
| `npm run dev` | backend, frontend | Dev server with reload |
| `npm run build` / `npm start` | backend, frontend | Production build and run |
| `npm run typecheck` | backend | `tsc --noEmit` |
| `npm test` | backend | Unit tests (vitest) |
| `npm run db:migrate` | backend | Apply the schema; `--force` recreates it |
| `npm run db:seed` | backend | Insert the sample rows |
| `npm run db:reset` | backend | Recreate and reseed |

### Environment variables

Backend (`backend/.env`, see `.env.example`):

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `4000` | |
| `DATABASE_URL` | required | |
| `DATABASE_SSL` | `false` | `true` for most hosted databases |
| `DATABASE_POOL_MAX` | `10` | |
| `JWT_SECRET` | required | 32 characters or more, validated at boot |
| `JWT_EXPIRES_IN` | `7d` | |
| `BCRYPT_ROUNDS` | `10` | |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | `60000` / `120` | Global, per IP |
| `AUTH_RATE_LIMIT_MAX` / `CHAT_RATE_LIMIT_MAX` | `10` / `20` | Per IP, per user |
| `MISTRAL_API_KEY` | empty | Empty turns on the fallback planner |
| `MISTRAL_MODEL` | `mistral-small-latest` | |
| `AI_TIMEOUT_MS` | `15000` | |
| `AI_HISTORY_TURNS` | `12` | Turns sent as conversation memory |

Frontend (`frontend/.env.local`): `NEXT_PUBLIC_API_URL`, default `http://localhost:4000`.

The backend validates its environment with zod at boot and exits with a list of problems rather than failing later on the first request.

## AI integration

Everything model-related lives in `backend/src/modules/ai/`:

| File | Responsibility |
| --- | --- |
| `mistral.client.ts` | HTTP call, 15s timeout, one retry on timeouts and 429/5xx, typed `ProviderError` |
| `ai.prompt.ts` | System prompt: business hours, today's date, the signed-in customer, the draft so far, the JSON contract and the rules |
| `ai.service.ts` | Orchestration: build messages, call, validate, log, fall back |
| `booking-fields.ts` | Sanitise, merge and completeness checks on extracted fields |
| `fallback-planner.ts` | Deterministic extraction used when the model is unavailable or wrong |
| `ai.repository.ts` | Writes `ai_interactions` |

**The contract.** The model is asked for JSON mode and a fixed object: a `reply`, an `intent`, and a `fields` object with the five booking fields plus notes, `null` for anything the customer has not said. The prompt carries the draft collected so far, so multi-turn memory is explicit rather than only implied by the transcript.

**Guardrails.** The model's output is treated as untrusted input:

- `JSON.parse` and a zod schema reject anything off-shape.
- Each field is sanitised by type: dates must be `YYYY-MM-DD` and within a year, times must be 24-hour, emails must match an email pattern, strings are stripped of control characters and truncated. A hallucinated `"next tuesday"` in the date field becomes `null`, not a bad row.
- Completeness is recomputed from the sanitised fields, so `readyToBook`-style claims from the model cannot trigger a write.
- Slot legality is decided by the appointment service against the database, never by the model.
- The reply is length-capped before it is stored.

**Fallbacks.** Three failure modes, one behaviour: keep the conversation useful.

| Failure | What happens |
| --- | --- |
| No API key configured | The rule-based planner answers every turn; `/health` reports `rule-based-fallback` |
| Provider error or timeout (after the retry) | Logged as `provider_error`, the planner answers, and the reply says the assistant is degraded |
| Response is not valid JSON or fails validation | Logged as `parse_error` with the raw text truncated, the planner answers |

The rule-based planner first classifies the message, and only extracts when it is actually a booking. A question such as "how much does a cleaning cost?" is answered as a question rather than quietly banking `service: Cleaning`, so an off-topic message cannot pollute the draft; an explicit booking verb still wins, so "can you book me a cleaning tomorrow at 2pm?" books. Opening-hours questions are answered from the business row, and availability questions say plainly that slots cannot be listed, since the planner has no calendar data. When the message is a booking it resolves relative dates ("tomorrow", "next Tuesday"), meridiem and 24-hour times, emails, names and a service phrase, then asks for at most two missing details per reply. It is also the reason the project can be reviewed without an API key.

Smalltalk, pricing and availability answers are outside what the brief asks the AI to do; the classifier exists so that the required job, extracting booking details, is not done wrongly on input that was never a booking.

Beyond those, the product-level fallback is the structured form: after three user turns with details still missing, the turn comes back with `needsForm: true` and the UI opens the booking form prefilled from the draft.

**Logging.** Every call writes one `ai_interactions` row: provider, model, status, request summary, response summary, token counts, latency, and the error message when it failed. A partial index on the failed rows keeps error-rate queries cheap. The same facts go to the structured log. Writing that row never breaks a request; a logging failure is caught and logged.

## Security

- bcrypt hashing; `password_hash` never leaves the repository layer, and login compares against a dummy hash for unknown emails so timing does not reveal which emails exist.
- JWTs signed with an issuer claim and verified on both REST requests and the socket handshake. `businessId` comes from the token, so a client cannot address another tenant's data by changing an id.
- Every request body, query and param goes through a zod schema before a handler runs.
- Rate limits on everything, stricter on auth, and per user on the AI-backed chat routes including the socket path.
- `helmet`, an explicit CORS allow-list, a 64 KB body cap, `x-powered-by` disabled.
- Parameterised SQL everywhere.
- Internal error messages are not returned in production; the client gets a code, a message and a request id that matches the server logs.
- Tokens, cookies, passwords and API keys are redacted in logs.

## Tests and verification

`cd backend && npm test` runs 24 unit tests over the logic worth pinning down: date and time parsing, business-hour and slot-grid checks, field sanitisation and merging, the completeness guard, and the fallback planner's extraction. One of them caught the planner treating "I want to book an appointment" as a service named "To Book An".

Verified by hand against a real PostgreSQL instance, using curl and a Socket.IO client:

- Signup, login, `GET /me`, rejected weak passwords, `401` on unauthenticated access.
- A full multi-turn booking: intent, then service, then date and time, ending in a row in `appointments`.
- Double-booking the same slot, asking for 07:00 when the business opens at 09:00, and an illegal `cancelled → confirmed` transition, all answered correctly.
- The socket path: handshake auth, `chat:send` acknowledgement, both `chat:message` broadcasts, `chat:state`, `chat:thinking` and `appointment:created`, plus a rejected empty message.
- All three AI paths, by pointing `MISTRAL_BASE_URL` at a stand-in provider: a successful extraction (logged `success` with token counts), a non-JSON reply (logged `parse_error`, planner answered), and a 503 (logged `provider_error` after the retry, planner answered).

What is not covered: no integration tests against a test database, no frontend component tests, and the live Mistral endpoint was exercised through a stand-in rather than the real service.

## Design decisions and tradeoffs

**The AI layer proposes, the service layer decides.** The model only produces candidate fields. Completeness, slot legality and persistence are the appointment service's job. The cost is that the assistant cannot be creative about rules; the benefit is that no prompt can talk the system into a bad booking, and the booking rules have one home that both the chat and the form go through.

**The conversation draft lives in the database, not the prompt.** `chat_sessions.draft` is the accumulated state, and it is merged server-side each turn. The transcript is still sent for tone and context, but losing a message or truncating history cannot lose a captured field.

**A deterministic planner behind the model.** This is the decision I would defend hardest. It makes the prototype reviewable without credentials, it turns provider outages into degraded service instead of an error screen, and it keeps the extraction rules testable. The tradeoff is a second extraction path to maintain, so it is deliberately narrow: dates, times, email, name, a service phrase.

**Socket.IO with a REST twin.** Every chat action exists as both an event and an endpoint, calling the same service. More surface area, but the socket is an optimisation rather than a dependency, and the frontend shows which transport it is on.

**Hand-written SQL over an ORM.** The schema is a graded artifact; an ORM would hide the indexes and constraints that carry the design. The cost is manual row mapping, kept to one `to*` function per repository.

**Each signup gets its own business.** `business_id` is threaded through every table and query from day one, so multi-tenancy is structural, but there is no invite flow, so a tenant currently has one user. The `role` column and the `customer` scoping in the appointment service are the hook for that.

**Cancel instead of delete.** `DELETE /api/appointments/:id` sets `cancelled`, which keeps history and frees the slot through the partial unique index.

**JWT in `localStorage`.** Simple, and it makes the socket handshake trivial. It is also XSS-exposed; a production build would use an httpOnly refresh cookie with a short-lived access token, which also needs CSRF handling and a token refresh path.

**UTC everywhere.** Removes a whole class of timezone bugs from a prototype, at the cost of realism. `businesses.timezone` is in the schema for the real version.

## Assumptions and known limitations

Assumptions:

- One bookable resource per business, so a slot is free or taken for the business as a whole.
- The signed-in user books for themselves by default, so their name and email seed the draft; the assistant uses someone else's details if the conversation names them.
- Appointments are a fixed length per business (`slot_minutes`), 30 minutes by default.
- Confirmation emails are described in the copy but not sent; there is no mail provider.

Limitations:

- All times are UTC, as above.
- The chat shows one open conversation per user. Closed sessions are kept and listed by the API but there is no UI to browse them.
- No refresh tokens, password reset, email verification or user invites.
- Rate limiting and the socket counter are in-process, so they do not hold across multiple API instances; Redis would be the next step along with a Socket.IO adapter for cross-instance broadcasts.
- No pagination UI; the dashboard requests the first 50 appointments.
- Reschedule and cancel are available in the appointment list but not yet as conversational intents, although the AI layer already classifies them.
- Accessibility has had reasonable care (labels, focus rings, `aria-label`s, `role="alert"`) but no audit.

## Deployment

The live demo runs on three free tiers:

| Piece | Host | Notes |
| --- | --- | --- |
| Frontend | Vercel | Root directory `frontend`, `NEXT_PUBLIC_API_URL` set to the API origin. Baked in at build time, so changing the API URL needs a redeploy |
| API | Render (Docker) | Builds the root [`Dockerfile`](./Dockerfile); the container runs `scripts/migrate.mjs` before the server, so a fresh database migrates itself |
| PostgreSQL | Neon | Pooled connection string, `DATABASE_SSL=true` |

The API needs the WebSocket to stay open, which rules out serverless functions for that half; Vercel serves the frontend and Render runs a persistent Node process.

Environment variables on the API host: `DATABASE_URL`, `DATABASE_SSL=true`, `JWT_SECRET` (32+ characters), `MISTRAL_API_KEY`, and `CORS_ORIGINS` set to the exact frontend origin. `NODE_ENV` and `PORT` come from the image and the platform.

[`render.yaml`](./render.yaml) describes the same stack as a blueprint for Render's own PostgreSQL, if you would rather not use Neon. Railway and Fly.io work the same way: build from the root `Dockerfile`, set `DATABASE_SSL=true`.

**Containers.** `docker compose up --build` runs all three locally. The root `Dockerfile` builds from the repo root so it can copy both `backend/` and `database/`; `frontend/Dockerfile` is multi-stage with `output: "standalone"`.

After deploying, `GET /health` reports whether the database is reachable and whether the AI provider is configured:

```json
{"status":"ok","aiProvider":"mistral","checks":{"database":"ok"}}
```

`aiProvider: "rule-based-fallback"` means no API key is set. Note that the check runs `SELECT 1`, so it proves connectivity rather than schema — a fresh database that has not migrated still reports `ok` while every query fails.

## Repository layout

```
backend/
  src/
    config/        env validation, pg pool, logger
    middleware/    request logging, auth, zod validation, rate limits, error handler
    modules/
      ai/          provider client, prompt, sanitisers, fallback planner, call log
      appointments/ booking rules, slot checks, status transitions
      auth/        signup, login, profile
      businesses/  tenant config
      chat/        turn orchestration, REST routes, Socket.IO gateway
    utils/         ApiError, async handler, JWT, date and time helpers
    app.ts         middleware chain and health check
    server.ts      HTTP server, Socket.IO, graceful shutdown
  scripts/         migrate.mjs, seed.mjs
database/
  schema.sql       DDL: 6 tables, 6 enums, indexes, triggers, a view
  seed.sql         sample rows for two tenants
  README.md        table rationale, indexing strategy, performance notes
docs/api.md        endpoint and socket reference
frontend/
  app/             login, signup, dashboard routes
  components/      chat, appointments, auth, layout, ui primitives
  lib/             api client, auth context, useChat, useAppointments, formatters
docker-compose.yml
render.yaml
```
