CREATE TABLE public.brok_cloud_chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'new chat',
  messages JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT brok_cloud_chats_messages_array
    CHECK (jsonb_typeof(messages) = 'array'),
  CONSTRAINT brok_cloud_chats_messages_size
    CHECK (pg_column_size(messages) <= 1048576)
);

CREATE INDEX brok_cloud_chats_user_updated_idx
  ON public.brok_cloud_chats (user_id, updated_at DESC);

ALTER TABLE public.brok_cloud_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY brok_cloud_chats_admin ON public.brok_cloud_chats
  FOR ALL TO project_admin USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY brok_cloud_chats_select ON public.brok_cloud_chats
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid())::TEXT);

CREATE POLICY brok_cloud_chats_insert ON public.brok_cloud_chats
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid())::TEXT);

CREATE POLICY brok_cloud_chats_update ON public.brok_cloud_chats
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())::TEXT)
  WITH CHECK (user_id = (SELECT auth.uid())::TEXT);

CREATE POLICY brok_cloud_chats_delete ON public.brok_cloud_chats
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid())::TEXT);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_cloud_chats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_cloud_chats TO project_admin;

CREATE TRIGGER brok_cloud_chats_updated_at
  BEFORE UPDATE ON public.brok_cloud_chats
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

NOTIFY pgrst, 'reload schema';
