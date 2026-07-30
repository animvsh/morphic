CREATE TABLE IF NOT EXISTS public.brok_projects (
  id TEXT PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 280),
  instructions TEXT NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brok_projects_owner_updated_idx
  ON public.brok_projects (owner_id, updated_at DESC);

ALTER TABLE public.brok_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brok_projects_select ON public.brok_projects;
CREATE POLICY brok_projects_select
  ON public.brok_projects
  FOR SELECT
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS brok_projects_insert ON public.brok_projects;
CREATE POLICY brok_projects_insert
  ON public.brok_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS brok_projects_update ON public.brok_projects;
CREATE POLICY brok_projects_update
  ON public.brok_projects
  FOR UPDATE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS brok_projects_delete ON public.brok_projects;
CREATE POLICY brok_projects_delete
  ON public.brok_projects
  FOR DELETE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP TRIGGER IF EXISTS brok_projects_updated_at ON public.brok_projects;
CREATE TRIGGER brok_projects_updated_at
  BEFORE UPDATE ON public.brok_projects
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

REVOKE ALL ON public.brok_projects FROM anon;
REVOKE UPDATE ON public.brok_projects FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.brok_projects TO authenticated;
GRANT UPDATE (name, description, instructions) ON public.brok_projects
  TO authenticated;

CREATE TABLE IF NOT EXISTS public.brok_project_chats (
  project_id TEXT NOT NULL
    REFERENCES public.brok_projects(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL
    REFERENCES public.brok_chats(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, chat_id)
);

CREATE INDEX IF NOT EXISTS brok_project_chats_owner_idx
  ON public.brok_project_chats (owner_id, added_at DESC);
CREATE INDEX IF NOT EXISTS brok_project_chats_chat_idx
  ON public.brok_project_chats (chat_id);

CREATE OR REPLACE FUNCTION public.validate_brok_project_chat_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.brok_projects
    WHERE id = NEW.project_id
      AND owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'project ownership mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.brok_chats
    WHERE id = NEW.chat_id
      AND user_id = NEW.owner_id::text
  ) THEN
    RAISE EXCEPTION 'chat ownership mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_brok_project_chat_ownership
  ON public.brok_project_chats;
CREATE TRIGGER validate_brok_project_chat_ownership
  BEFORE INSERT OR UPDATE ON public.brok_project_chats
  FOR EACH ROW EXECUTE FUNCTION public.validate_brok_project_chat_ownership();

ALTER TABLE public.brok_project_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brok_project_chats_select
  ON public.brok_project_chats;
CREATE POLICY brok_project_chats_select
  ON public.brok_project_chats
  FOR SELECT
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS brok_project_chats_insert
  ON public.brok_project_chats;
CREATE POLICY brok_project_chats_insert
  ON public.brok_project_chats
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS brok_project_chats_delete
  ON public.brok_project_chats;
CREATE POLICY brok_project_chats_delete
  ON public.brok_project_chats
  FOR DELETE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

REVOKE ALL ON public.brok_project_chats FROM anon;
REVOKE UPDATE ON public.brok_project_chats FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.brok_project_chats TO authenticated;
