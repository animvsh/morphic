ALTER TABLE public.brok_request_events
  DROP CONSTRAINT IF EXISTS brok_request_events_chat_id_fkey;

INSERT INTO public.brok_schema_migrations (version, description)
VALUES (
  '20260721234500',
  'Allow durable guest request correlation without a persisted chat row'
)
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
