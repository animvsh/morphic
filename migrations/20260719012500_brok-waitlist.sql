CREATE TABLE public.brok_waitlist (
  email TEXT PRIMARY KEY CHECK (email = LOWER(email)),
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'invited', 'active')),
  source TEXT NOT NULL DEFAULT 'guest-home',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX brok_waitlist_status_created_idx
  ON public.brok_waitlist (status, created_at DESC);

ALTER TABLE public.brok_waitlist ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_waitlist TO project_admin;

CREATE POLICY brok_waitlist_admin ON public.brok_waitlist
  FOR ALL TO project_admin USING (TRUE) WITH CHECK (TRUE);

CREATE TRIGGER brok_waitlist_updated_at
  BEFORE UPDATE ON public.brok_waitlist
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

NOTIFY pgrst, 'reload schema';
