CREATE TABLE public.brok_admin_memberships (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'support', 'read_only')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.brok_schema_migrations (
  version TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX brok_admin_memberships_role_status_idx
  ON public.brok_admin_memberships (role, status);

CREATE TABLE public.brok_account_controls (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'deleted')),
  suspension_reason TEXT,
  suspended_until TIMESTAMPTZ,
  quick_daily_limit INTEGER CHECK (quick_daily_limit BETWEEN 1 AND 100000),
  adaptive_daily_limit INTEGER CHECK (adaptive_daily_limit BETWEEN 1 AND 100000),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX brok_account_controls_status_idx
  ON public.brok_account_controls (status, updated_at DESC);

CREATE TABLE public.brok_model_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL,
  input_per_million_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  output_per_million_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  cache_read_per_million_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  cache_write_per_million_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT brok_model_rates_effective_range
    CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT brok_model_rates_model_start_unique
    UNIQUE (model_id, effective_from)
);

CREATE INDEX brok_model_rates_lookup_idx
  ON public.brok_model_rates (model_id, effective_from DESC);

CREATE TABLE public.brok_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_key TEXT,
  -- Guest conversations are ephemeral and therefore may not have a brok_chats row.
  chat_id TEXT,
  request_message_id TEXT,
  response_message_id TEXT,
  query_text TEXT NOT NULL DEFAULT '',
  trigger TEXT NOT NULL DEFAULT 'submit-message'
    CHECK (trigger IN ('submit-message', 'regenerate-message')),
  search_mode TEXT NOT NULL DEFAULT 'quick'
    CHECK (search_mode IN ('quick', 'adaptive')),
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'succeeded', 'failed', 'aborted')),
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  reasoning_tokens INTEGER CHECK (reasoning_tokens IS NULL OR reasoning_tokens >= 0),
  cache_read_tokens INTEGER CHECK (cache_read_tokens IS NULL OR cache_read_tokens >= 0),
  cache_write_tokens INTEGER CHECK (cache_write_tokens IS NULL OR cache_write_tokens >= 0),
  total_tokens INTEGER CHECK (total_tokens IS NULL OR total_tokens >= 0),
  search_calls INTEGER NOT NULL DEFAULT 0 CHECK (search_calls >= 0),
  fetch_calls INTEGER NOT NULL DEFAULT 0 CHECK (fetch_calls >= 0),
  tool_calls INTEGER NOT NULL DEFAULT 0 CHECK (tool_calls >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_token_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  first_token_ms INTEGER CHECK (first_token_ms IS NULL OR first_token_ms >= 0),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  error_code TEXT,
  error_message TEXT,
  trace_id TEXT,
  estimated_cost_usd NUMERIC(14, 8),
  pricing_rate_id UUID REFERENCES public.brok_model_rates(id) ON DELETE SET NULL,
  metrics_recorded BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT brok_request_events_actor
    CHECK (user_id IS NOT NULL OR guest_key IS NOT NULL)
);

CREATE INDEX brok_request_events_user_started_idx
  ON public.brok_request_events (user_id, started_at DESC, id DESC);
CREATE INDEX brok_request_events_started_idx
  ON public.brok_request_events (started_at DESC, id DESC);
CREATE INDEX brok_request_events_status_started_idx
  ON public.brok_request_events (status, started_at DESC);
CREATE INDEX brok_request_events_chat_idx
  ON public.brok_request_events (chat_id, started_at DESC);
CREATE INDEX brok_request_events_model_idx
  ON public.brok_request_events (model_id, started_at DESC);

CREATE TABLE public.brok_admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  before_state JSONB,
  after_state JSONB,
  reason TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX brok_admin_audit_actor_created_idx
  ON public.brok_admin_audit_log (actor_user_id, created_at DESC);
CREATE INDEX brok_admin_audit_target_created_idx
  ON public.brok_admin_audit_log (target_type, target_id, created_at DESC);

ALTER TABLE public.brok_feedback
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS brok_feedback_status_created_idx
  ON public.brok_feedback (status, created_at DESC);

ALTER TABLE public.brok_admin_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brok_schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brok_account_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brok_model_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brok_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brok_admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY brok_admin_memberships_project_admin
  ON public.brok_admin_memberships FOR ALL TO project_admin
  USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY brok_schema_migrations_project_admin
  ON public.brok_schema_migrations FOR ALL TO project_admin
  USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY brok_account_controls_project_admin
  ON public.brok_account_controls FOR ALL TO project_admin
  USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY brok_model_rates_project_admin
  ON public.brok_model_rates FOR ALL TO project_admin
  USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY brok_request_events_project_admin
  ON public.brok_request_events FOR ALL TO project_admin
  USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY brok_admin_audit_project_admin
  ON public.brok_admin_audit_log FOR ALL TO project_admin
  USING (TRUE) WITH CHECK (TRUE);

REVOKE ALL ON public.brok_admin_memberships FROM anon, authenticated;
REVOKE ALL ON public.brok_schema_migrations FROM anon, authenticated;
REVOKE ALL ON public.brok_account_controls FROM anon, authenticated;
REVOKE ALL ON public.brok_model_rates FROM anon, authenticated;
REVOKE ALL ON public.brok_request_events FROM anon, authenticated;
REVOKE ALL ON public.brok_admin_audit_log FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_admin_memberships TO project_admin;
GRANT SELECT, INSERT ON public.brok_schema_migrations TO project_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_account_controls TO project_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_model_rates TO project_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_request_events TO project_admin;
GRANT SELECT, INSERT ON public.brok_admin_audit_log TO project_admin;
REVOKE UPDATE, DELETE, TRUNCATE ON public.brok_admin_audit_log FROM project_admin;

CREATE TRIGGER brok_admin_memberships_updated_at
  BEFORE UPDATE ON public.brok_admin_memberships
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER brok_account_controls_updated_at
  BEFORE UPDATE ON public.brok_account_controls
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER brok_request_events_updated_at
  BEFORE UPDATE ON public.brok_request_events
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER brok_feedback_admin_updated_at
  BEFORE UPDATE ON public.brok_feedback
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE OR REPLACE FUNCTION public.brok_prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'brok_admin_audit_log is append-only';
END;
$$;

CREATE TRIGGER brok_admin_audit_append_only
  BEFORE UPDATE OR DELETE ON public.brok_admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.brok_prevent_audit_mutation();

CREATE OR REPLACE FUNCTION public.brok_protect_last_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'owner' AND OLD.status = 'active'
       AND (SELECT COUNT(*) FROM public.brok_admin_memberships
            WHERE role = 'owner' AND status = 'active') <= 1 THEN
      RAISE EXCEPTION 'cannot remove the final Brok owner';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.role = 'owner' AND OLD.status = 'active'
     AND (NEW.role <> 'owner' OR NEW.status <> 'active')
     AND (SELECT COUNT(*) FROM public.brok_admin_memberships
          WHERE role = 'owner' AND status = 'active') <= 1 THEN
    RAISE EXCEPTION 'cannot disable the final Brok owner';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER brok_admin_memberships_protect_owner
  BEFORE UPDATE OR DELETE ON public.brok_admin_memberships
  FOR EACH ROW EXECUTE FUNCTION public.brok_protect_last_owner();

CREATE OR REPLACE FUNCTION public.brok_calculate_request_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  selected_rate public.brok_model_rates%ROWTYPE;
BEGIN
  SELECT * INTO selected_rate
  FROM public.brok_model_rates
  WHERE model_id = NEW.model_id
    AND effective_from <= COALESCE(NEW.started_at, NOW())
    AND (effective_to IS NULL OR effective_to > COALESCE(NEW.started_at, NOW()))
  ORDER BY effective_from DESC
  LIMIT 1;

  IF selected_rate.id IS NOT NULL THEN
    NEW.pricing_rate_id := selected_rate.id;
    NEW.estimated_cost_usd :=
      (COALESCE(NEW.input_tokens, 0) * selected_rate.input_per_million_usd
       + COALESCE(NEW.output_tokens, 0) * selected_rate.output_per_million_usd
       + COALESCE(NEW.cache_read_tokens, 0) * selected_rate.cache_read_per_million_usd
       + COALESCE(NEW.cache_write_tokens, 0) * selected_rate.cache_write_per_million_usd)
      / 1000000.0;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER brok_request_events_calculate_cost
  BEFORE INSERT OR UPDATE OF input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, model_id
  ON public.brok_request_events
  FOR EACH ROW EXECUTE FUNCTION public.brok_calculate_request_cost();

CREATE OR REPLACE VIEW public.brok_admin_user_directory AS
SELECT
  user_row.id,
  user_row.email,
  user_row.email_verified,
  user_row.created_at,
  user_row.updated_at,
  COALESCE(user_row.profile->>'full_name', user_row.profile->>'name', split_part(user_row.email, '@', 1)) AS name,
  user_row.profile->>'avatar_url' AS avatar_url,
  COALESCE(user_row.metadata->>'provider', user_row.profile->>'provider', 'email') AS auth_provider,
  CASE
    WHEN control.status = 'suspended'
      AND control.suspended_until IS NOT NULL
      AND control.suspended_until <= NOW() THEN 'active'
    ELSE COALESCE(control.status, 'active')
  END AS account_status,
  control.suspension_reason,
  control.suspended_until,
  control.quick_daily_limit,
  control.adaptive_daily_limit,
  COALESCE(chat_stats.chat_count, 0)::BIGINT AS chat_count,
  COALESCE(request_stats.query_count, 0)::BIGINT AS query_count,
  COALESCE(request_stats.total_tokens, 0)::BIGINT AS total_tokens,
  COALESCE(request_stats.estimated_cost_usd, 0)::NUMERIC(14, 8) AS estimated_cost_usd,
  request_stats.last_active_at,
  COALESCE(note_stats.note_count, 0)::BIGINT AS note_count,
  COALESCE(file_stats.file_count, 0)::BIGINT AS file_count,
  COALESCE(file_stats.storage_bytes, 0)::BIGINT AS storage_bytes,
  COALESCE(feedback_stats.feedback_count, 0)::BIGINT AS feedback_count
FROM auth.users AS user_row
LEFT JOIN public.brok_account_controls AS control ON control.user_id = user_row.id
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS chat_count
  FROM public.brok_chats AS chat
  WHERE chat.user_id = user_row.id::TEXT
) AS chat_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS query_count,
    SUM(COALESCE(event.total_tokens, 0)) AS total_tokens,
    SUM(COALESCE(event.estimated_cost_usd, 0)) AS estimated_cost_usd,
    MAX(event.started_at) AS last_active_at
  FROM public.brok_request_events AS event
  WHERE event.user_id = user_row.id
) AS request_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS note_count
  FROM public.brok_notes AS note
  WHERE note.user_id = user_row.id::TEXT
) AS note_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS file_count, SUM(COALESCE(file.size, 0)) AS storage_bytes
  FROM public.brok_library_files AS file
  WHERE file.user_id = user_row.id::TEXT
) AS file_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS feedback_count
  FROM public.brok_feedback AS feedback
  WHERE feedback.user_id = user_row.id::TEXT
) AS feedback_stats ON TRUE;

REVOKE ALL ON public.brok_admin_user_directory FROM anon, authenticated;
GRANT SELECT ON public.brok_admin_user_directory TO project_admin;

CREATE OR REPLACE VIEW public.brok_admin_query_directory AS
SELECT
  event.*,
  user_row.email,
  COALESCE(user_row.profile->>'full_name', user_row.profile->>'name', split_part(user_row.email, '@', 1)) AS user_name,
  COALESCE((
    SELECT string_agg(part.payload->>'text', ' ' ORDER BY part.part_order)
    FROM public.brok_message_parts AS part
    WHERE part.message_id = event.response_message_id
      AND part.payload ? 'text'
  ), '') AS response_preview
FROM public.brok_request_events AS event
LEFT JOIN auth.users AS user_row ON user_row.id = event.user_id;

REVOKE ALL ON public.brok_admin_query_directory FROM anon, authenticated;
GRANT SELECT ON public.brok_admin_query_directory TO project_admin;

CREATE OR REPLACE VIEW public.brok_admin_usage_daily AS
SELECT
  date_trunc('day', started_at) AS usage_day,
  search_mode,
  model_id,
  status,
  COUNT(*)::BIGINT AS query_count,
  COUNT(DISTINCT user_id)::BIGINT AS active_users,
  COALESCE(SUM(total_tokens), 0)::BIGINT AS total_tokens,
  COALESCE(SUM(estimated_cost_usd), 0)::NUMERIC(14, 8) AS estimated_cost_usd,
  COALESCE(AVG(first_token_ms), 0)::NUMERIC(14, 2) AS average_first_token_ms,
  COALESCE(AVG(duration_ms), 0)::NUMERIC(14, 2) AS average_duration_ms
FROM public.brok_request_events
GROUP BY date_trunc('day', started_at), search_mode, model_id, status;

REVOKE ALL ON public.brok_admin_usage_daily FROM anon, authenticated;
GRANT SELECT ON public.brok_admin_usage_daily TO project_admin;

CREATE OR REPLACE FUNCTION public.brok_admin_dashboard(
  range_start TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  range_end TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'totalUsers', (SELECT COUNT(*) FROM auth.users),
    'newUsers', (SELECT COUNT(*) FROM auth.users WHERE created_at >= range_start AND created_at < range_end),
    'activeUsers', (SELECT COUNT(DISTINCT user_id) FROM public.brok_request_events WHERE started_at >= range_start AND started_at < range_end AND user_id IS NOT NULL),
    'queries', (SELECT COUNT(*) FROM public.brok_request_events WHERE started_at >= range_start AND started_at < range_end),
    'successfulQueries', (SELECT COUNT(*) FROM public.brok_request_events WHERE started_at >= range_start AND started_at < range_end AND status = 'succeeded'),
    'failedQueries', (SELECT COUNT(*) FROM public.brok_request_events WHERE started_at >= range_start AND started_at < range_end AND status = 'failed'),
    'totalTokens', (SELECT COALESCE(SUM(total_tokens), 0) FROM public.brok_request_events WHERE started_at >= range_start AND started_at < range_end),
    'estimatedCostUsd', (SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM public.brok_request_events WHERE started_at >= range_start AND started_at < range_end),
    'averageDurationMs', (SELECT COALESCE(AVG(duration_ms), 0) FROM public.brok_request_events WHERE started_at >= range_start AND started_at < range_end AND duration_ms IS NOT NULL),
    'averageFirstTokenMs', (SELECT COALESCE(AVG(first_token_ms), 0) FROM public.brok_request_events WHERE started_at >= range_start AND started_at < range_end AND first_token_ms IS NOT NULL),
    'feedbackCount', (SELECT COUNT(*) FROM public.brok_feedback WHERE created_at >= range_start AND created_at < range_end),
    'storageBytes', (SELECT COALESCE(SUM(size), 0) FROM public.brok_library_files)
  );
$$;

REVOKE ALL ON FUNCTION public.brok_admin_dashboard(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.brok_admin_dashboard(TIMESTAMPTZ, TIMESTAMPTZ) TO project_admin;

CREATE OR REPLACE FUNCTION public.brok_admin_anonymize_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  UPDATE public.brok_request_events
  SET user_id = NULL,
      guest_key = 'deleted:' || md5(target_user_id::TEXT),
      query_text = '[deleted]',
      error_message = NULL
  WHERE user_id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.brok_admin_anonymize_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.brok_admin_anonymize_user(UUID) TO project_admin;

INSERT INTO public.brok_model_rates (
  model_id,
  input_per_million_usd,
  output_per_million_usd,
  cache_read_per_million_usd,
  cache_write_per_million_usd,
  effective_from,
  source_url
) VALUES
  ('MiniMax-M2.7', 0.30, 1.20, 0.06, 0.375, '2026-07-21T00:00:00Z', 'https://platform.minimax.io/docs/guides/pricing-paygo'),
  ('MiniMax-M2.7-highspeed', 0.60, 2.40, 0.06, 0.375, '2026-07-21T00:00:00Z', 'https://platform.minimax.io/docs/guides/pricing-paygo');

-- Preserve historical query visibility without inventing token or timing data.
INSERT INTO public.brok_request_events (
  user_id,
  chat_id,
  request_message_id,
  response_message_id,
  query_text,
  trigger,
  search_mode,
  provider_id,
  model_id,
  status,
  started_at,
  completed_at,
  metrics_recorded
)
SELECT
  user_row.id,
  chat.id,
  message.id,
  response.id,
  COALESCE((
    SELECT string_agg(part.payload->>'text', ' ' ORDER BY part.part_order)
    FROM public.brok_message_parts AS part
    WHERE part.message_id = message.id AND part.payload ? 'text'
  ), ''),
  'submit-message',
  CASE
    WHEN message.metadata->>'searchMode' IN ('quick', 'adaptive')
      THEN message.metadata->>'searchMode'
    ELSE 'quick'
  END,
  COALESCE(NULLIF(split_part(message.metadata->>'modelId', ':', 1), ''), 'legacy'),
  COALESCE(NULLIF(split_part(message.metadata->>'modelId', ':', 2), ''), 'legacy'),
  'succeeded',
  message.created_at,
  response.created_at,
  FALSE
FROM public.brok_messages AS message
JOIN public.brok_chats AS chat ON chat.id = message.chat_id
JOIN auth.users AS user_row ON user_row.id::TEXT = chat.user_id
LEFT JOIN LATERAL (
  SELECT candidate.id, candidate.created_at
  FROM public.brok_messages AS candidate
  WHERE candidate.chat_id = message.chat_id
    AND candidate.role = 'assistant'
    AND candidate.created_at >= message.created_at
  ORDER BY candidate.created_at, candidate.id
  LIMIT 1
) AS response ON TRUE
WHERE message.role = 'user'
  AND NOT EXISTS (
    SELECT 1
    FROM public.brok_request_events AS existing
    WHERE existing.request_message_id = message.id
  );

INSERT INTO public.brok_schema_migrations (version, description)
VALUES ('20260721231500', 'Brok admin panel and durable usage ledger')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
