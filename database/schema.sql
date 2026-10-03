BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('owner', 'staff', 'customer');
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE appointment_source AS ENUM ('chat', 'form');
CREATE TYPE chat_session_status AS ENUM ('active', 'closed');
CREATE TYPE message_sender AS ENUM ('user', 'assistant', 'system');
CREATE TYPE ai_call_status AS ENUM ('success', 'parse_error', 'provider_error');

CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE businesses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  slug            text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,60}$'),
  timezone        text NOT NULL DEFAULT 'UTC',
  opening_hour    smallint NOT NULL DEFAULT 9 CHECK (opening_hour BETWEEN 0 AND 23),
  closing_hour    smallint NOT NULL DEFAULT 17 CHECK (closing_hour BETWEEN 1 AND 24),
  slot_minutes    smallint NOT NULL DEFAULT 30 CHECK (slot_minutes IN (15, 30, 60)),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT businesses_hours_ordered CHECK (closing_hour > opening_hour)
);

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email           text NOT NULL,
  password_hash   text NOT NULL,
  full_name       text NOT NULL CHECK (length(btrim(full_name)) > 0),
  role            user_role NOT NULL DEFAULT 'owner',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_normalised CHECK (email = lower(email) AND email LIKE '%_@_%._%')
);

CREATE UNIQUE INDEX users_email_key ON users (email);
CREATE INDEX users_business_id_idx ON users (business_id);

CREATE TABLE chat_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          chat_session_status NOT NULL DEFAULT 'active',
  title           text,
  draft           jsonb NOT NULL DEFAULT '{}'::jsonb,
  message_count   integer NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  last_message_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  closed_at       timestamptz,
  CONSTRAINT chat_sessions_closed_at_set CHECK ((status = 'closed') = (closed_at IS NOT NULL))
);

CREATE UNIQUE INDEX chat_sessions_one_active_per_user_idx
  ON chat_sessions (user_id)
  WHERE status = 'active';
CREATE INDEX chat_sessions_user_recent_idx ON chat_sessions (user_id, created_at DESC);
CREATE INDEX chat_sessions_business_recent_idx ON chat_sessions (business_id, last_message_at DESC);

CREATE TABLE chat_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender          message_sender NOT NULL,
  content         text NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  extracted_data  jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_session_order_idx ON chat_messages (session_id, created_at, id);

CREATE TABLE appointments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_session_id  uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  service          text NOT NULL CHECK (length(btrim(service)) > 0),
  customer_name    text NOT NULL CHECK (length(btrim(customer_name)) > 0),
  customer_email   text NOT NULL CHECK (customer_email = lower(customer_email)),
  scheduled_at     timestamptz NOT NULL,
  duration_minutes smallint NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 15 AND 480),
  status           appointment_status NOT NULL DEFAULT 'pending',
  source           appointment_source NOT NULL DEFAULT 'chat',
  notes            text CHECK (notes IS NULL OR length(notes) <= 2000),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX appointments_no_double_booking_idx
  ON appointments (business_id, scheduled_at)
  WHERE status IN ('pending', 'confirmed');
CREATE INDEX appointments_business_calendar_idx ON appointments (business_id, scheduled_at);
CREATE INDEX appointments_user_recent_idx ON appointments (user_id, scheduled_at DESC);
CREATE INDEX appointments_open_queue_idx
  ON appointments (business_id, status, scheduled_at)
  WHERE status IN ('pending', 'confirmed');
CREATE INDEX appointments_chat_session_idx ON appointments (chat_session_id)
  WHERE chat_session_id IS NOT NULL;

CREATE TABLE ai_interactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid REFERENCES businesses(id) ON DELETE CASCADE,
  session_id        uuid REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id        uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
  provider          text NOT NULL,
  model             text NOT NULL,
  status            ai_call_status NOT NULL,
  request_payload   jsonb NOT NULL,
  response_payload  jsonb,
  error_message     text,
  prompt_tokens     integer CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0),
  completion_tokens integer CHECK (completion_tokens IS NULL OR completion_tokens >= 0),
  latency_ms        integer NOT NULL CHECK (latency_ms >= 0),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_interactions_session_idx ON ai_interactions (session_id, created_at DESC);
CREATE INDEX ai_interactions_failures_idx ON ai_interactions (created_at DESC)
  WHERE status <> 'success';

CREATE TRIGGER businesses_set_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER appointments_set_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE VIEW business_daily_load AS
SELECT
  business_id,
  date_trunc('day', scheduled_at) AS day,
  count(*) FILTER (WHERE status = 'confirmed') AS confirmed_count,
  count(*) FILTER (WHERE status = 'pending') AS pending_count,
  count(*) FILTER (WHERE status = 'cancelled') AS cancelled_count,
  count(*) FILTER (WHERE status = 'completed') AS completed_count
FROM appointments
GROUP BY business_id, date_trunc('day', scheduled_at);

COMMIT;
