CREATE TABLE public.brok_chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX brok_chats_user_created_idx
  ON public.brok_chats (user_id, created_at DESC);

CREATE TABLE public.brok_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES public.brok_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX brok_messages_chat_created_idx
  ON public.brok_messages (chat_id, created_at, id);

CREATE TABLE public.brok_message_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL REFERENCES public.brok_messages(id) ON DELETE CASCADE,
  part_order INTEGER NOT NULL CHECK (part_order >= 0),
  part_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT brok_message_parts_message_order_unique
    UNIQUE (message_id, part_order),
  CONSTRAINT brok_message_parts_payload_size
    CHECK (pg_column_size(payload) <= 1048576)
);

CREATE INDEX brok_message_parts_message_order_idx
  ON public.brok_message_parts (message_id, part_order);

CREATE TABLE public.brok_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chat_id TEXT REFERENCES public.brok_chats(id) ON DELETE SET NULL,
  source_message_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX brok_notes_user_updated_idx
  ON public.brok_notes (user_id, updated_at DESC, id);

CREATE TABLE public.brok_library_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chat_id TEXT REFERENCES public.brok_chats(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  object_key TEXT NOT NULL,
  media_type TEXT NOT NULL,
  size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX brok_library_files_user_updated_idx
  ON public.brok_library_files (user_id, updated_at DESC, id);

CREATE UNIQUE INDEX brok_library_files_object_key_idx
  ON public.brok_library_files (object_key);

CREATE TABLE public.brok_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  message TEXT NOT NULL,
  page_url TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX brok_feedback_user_created_idx
  ON public.brok_feedback (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.brok_user_owns_chat(target_chat_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.brok_chats
    WHERE id = target_chat_id
      AND user_id = (SELECT auth.uid())::TEXT
  );
$$;

CREATE OR REPLACE FUNCTION public.brok_user_owns_message(target_message_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.brok_messages AS message
    JOIN public.brok_chats AS chat ON chat.id = message.chat_id
    WHERE message.id = target_message_id
      AND chat.user_id = (SELECT auth.uid())::TEXT
  );
$$;

ALTER TABLE public.brok_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brok_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brok_message_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brok_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brok_library_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brok_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY brok_chats_admin ON public.brok_chats
  FOR ALL TO project_admin USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY brok_messages_admin ON public.brok_messages
  FOR ALL TO project_admin USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY brok_parts_admin ON public.brok_message_parts
  FOR ALL TO project_admin USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY brok_notes_admin ON public.brok_notes
  FOR ALL TO project_admin USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY brok_files_admin ON public.brok_library_files
  FOR ALL TO project_admin USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY brok_feedback_admin ON public.brok_feedback
  FOR ALL TO project_admin USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY brok_chats_select ON public.brok_chats
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid())::TEXT OR visibility = 'public');
CREATE POLICY brok_chats_insert ON public.brok_chats
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid())::TEXT);
CREATE POLICY brok_chats_update ON public.brok_chats
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())::TEXT)
  WITH CHECK (user_id = (SELECT auth.uid())::TEXT);
CREATE POLICY brok_chats_delete ON public.brok_chats
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid())::TEXT);

CREATE POLICY brok_messages_select ON public.brok_messages
  FOR SELECT TO authenticated
  USING (public.brok_user_owns_chat(chat_id));
CREATE POLICY brok_messages_insert ON public.brok_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.brok_user_owns_chat(chat_id));
CREATE POLICY brok_messages_update ON public.brok_messages
  FOR UPDATE TO authenticated
  USING (public.brok_user_owns_chat(chat_id))
  WITH CHECK (public.brok_user_owns_chat(chat_id));
CREATE POLICY brok_messages_delete ON public.brok_messages
  FOR DELETE TO authenticated
  USING (public.brok_user_owns_chat(chat_id));

CREATE POLICY brok_parts_select ON public.brok_message_parts
  FOR SELECT TO authenticated
  USING (public.brok_user_owns_message(message_id));
CREATE POLICY brok_parts_insert ON public.brok_message_parts
  FOR INSERT TO authenticated
  WITH CHECK (public.brok_user_owns_message(message_id));
CREATE POLICY brok_parts_update ON public.brok_message_parts
  FOR UPDATE TO authenticated
  USING (public.brok_user_owns_message(message_id))
  WITH CHECK (public.brok_user_owns_message(message_id));
CREATE POLICY brok_parts_delete ON public.brok_message_parts
  FOR DELETE TO authenticated
  USING (public.brok_user_owns_message(message_id));

CREATE POLICY brok_notes_select ON public.brok_notes
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid())::TEXT);
CREATE POLICY brok_notes_insert ON public.brok_notes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid())::TEXT);
CREATE POLICY brok_notes_update ON public.brok_notes
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())::TEXT)
  WITH CHECK (user_id = (SELECT auth.uid())::TEXT);
CREATE POLICY brok_notes_delete ON public.brok_notes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid())::TEXT);

CREATE POLICY brok_files_select ON public.brok_library_files
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid())::TEXT);
CREATE POLICY brok_files_insert ON public.brok_library_files
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid())::TEXT);
CREATE POLICY brok_files_update ON public.brok_library_files
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())::TEXT)
  WITH CHECK (user_id = (SELECT auth.uid())::TEXT);
CREATE POLICY brok_files_delete ON public.brok_library_files
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid())::TEXT);

CREATE POLICY brok_feedback_insert ON public.brok_feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = (SELECT auth.uid())::TEXT);
CREATE POLICY brok_feedback_anonymize ON public.brok_feedback
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())::TEXT)
  WITH CHECK (user_id IS NULL);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_chats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_message_parts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_library_files TO authenticated;
GRANT INSERT ON public.brok_feedback TO anon, authenticated;
GRANT UPDATE ON public.brok_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_chats TO project_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_messages TO project_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_message_parts TO project_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_notes TO project_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_library_files TO project_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brok_feedback TO project_admin;

CREATE TRIGGER brok_chats_updated_at
  BEFORE UPDATE ON public.brok_chats
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER brok_notes_updated_at
  BEFORE UPDATE ON public.brok_notes
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();
CREATE TRIGGER brok_files_updated_at
  BEFORE UPDATE ON public.brok_library_files
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

NOTIFY pgrst, 'reload schema';
