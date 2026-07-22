CREATE OR REPLACE FUNCTION public.brok_prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  -- Deleting an auth user must be able to apply the declared ON DELETE SET
  -- NULL relationship. No audit content changes; only the deleted actor's
  -- identifier is anonymized while the immutable record is retained.
  IF TG_OP = 'UPDATE'
     AND OLD.actor_user_id IS NOT NULL
     AND NEW.actor_user_id IS NULL
     AND (to_jsonb(NEW) - 'actor_user_id') =
         (to_jsonb(OLD) - 'actor_user_id') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'brok_admin_audit_log is append-only';
END;
$$;

INSERT INTO public.brok_schema_migrations (version, description)
VALUES (
  '20260722003000',
  'Allow auth-user deletion to anonymize immutable audit actors'
)
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
