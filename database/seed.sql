BEGIN;

INSERT INTO businesses (id, name, slug, timezone, opening_hour, closing_hour, slot_minutes)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'Northside Dental', 'northside-dental', 'UTC', 9, 17, 30),
  ('22222222-2222-4222-8222-222222222222', 'Riverside Legal', 'riverside-legal', 'UTC', 8, 18, 60)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, business_id, email, password_hash, full_name, role)
VALUES
  (
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    'demo@schedulr.test',
    '$2a$10$43CLo0z2G.vGbyKOs6GbTuG2gcmPhRSPceYuXvVpdqrp9mcDfOYK2',
    'Dana Reyes',
    'owner'
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111',
    'nurse@schedulr.test',
    '$2a$10$43CLo0z2G.vGbyKOs6GbTuG2gcmPhRSPceYuXvVpdqrp9mcDfOYK2',
    'Sam Okafor',
    'staff'
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    '22222222-2222-4222-8222-222222222222',
    'counsel@schedulr.test',
    '$2a$10$43CLo0z2G.vGbyKOs6GbTuG2gcmPhRSPceYuXvVpdqrp9mcDfOYK2',
    'Priya Nair',
    'owner'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_sessions (id, business_id, user_id, status, title, draft, message_count, last_message_at, created_at, closed_at)
VALUES
  (
    '66666666-6666-4666-8666-666666666666',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    'closed',
    'need a cleaning next week',
    '{"service":"Cleaning","date":null,"time":null,"customerName":"Dana Reyes","customerEmail":"demo@schedulr.test","notes":null}'::jsonb,
    4,
    now() - interval '2 days',
    now() - interval '2 days',
    now() - interval '2 days'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_messages (session_id, sender, content, extracted_data, created_at)
VALUES
  (
    '66666666-6666-4666-8666-666666666666',
    'assistant',
    'Hi Dana, I book appointments for Northside Dental. What do you need and when?',
    '{"kind":"greeting"}'::jsonb,
    now() - interval '2 days'
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'user',
    'I need a cleaning next Tuesday at 10am',
    NULL,
    now() - interval '2 days' + interval '20 seconds'
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'assistant',
    'Booked Cleaning for Tuesday 10:00 UTC. A confirmation goes to demo@schedulr.test.',
    '{"intent":"book_appointment","source":"mistral","missingFields":[],"needsForm":false}'::jsonb,
    now() - interval '2 days' + interval '25 seconds'
  );

INSERT INTO appointments (business_id, user_id, chat_session_id, service, customer_name, customer_email,
                          scheduled_at, duration_minutes, status, source, notes)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    '66666666-6666-4666-8666-666666666666',
    'Cleaning',
    'Dana Reyes',
    'demo@schedulr.test',
    date_trunc('day', now() + interval '1 day') + interval '10 hours',
    30,
    'confirmed',
    'chat',
    'Booked through the assistant'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    NULL,
    'Consultation',
    'Dana Reyes',
    'demo@schedulr.test',
    date_trunc('day', now() + interval '2 days') + interval '14 hours 30 minutes',
    30,
    'pending',
    'form',
    NULL
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444',
    NULL,
    'Check-up',
    'Marcus Hale',
    'marcus@example.test',
    date_trunc('day', now() - interval '3 days') + interval '11 hours',
    30,
    'completed',
    'form',
    'Routine visit'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '55555555-5555-4555-8555-555555555555',
    NULL,
    'Contract Review',
    'Priya Nair',
    'counsel@schedulr.test',
    date_trunc('day', now() + interval '1 day') + interval '9 hours',
    60,
    'confirmed',
    'form',
    NULL
  );

INSERT INTO ai_interactions (business_id, session_id, provider, model, status, request_payload,
                             response_payload, prompt_tokens, completion_tokens, latency_ms, created_at)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    '66666666-6666-4666-8666-666666666666',
    'mistral',
    'mistral-small-latest',
    'success',
    '{"message":"I need a cleaning next Tuesday at 10am","turns":3}'::jsonb,
    '{"intent":"book_appointment","fields":{"service":"Cleaning","time":"10:00"},"missingFields":[]}'::jsonb,
    412,
    88,
    734,
    now() - interval '2 days'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    '66666666-6666-4666-8666-666666666666',
    'mistral',
    'mistral-small-latest',
    'provider_error',
    '{"message":"and can you move it to 11?","turns":5}'::jsonb,
    NULL,
    NULL,
    NULL,
    15000,
    now() - interval '2 days' + interval '1 minute'
  );

COMMIT;
