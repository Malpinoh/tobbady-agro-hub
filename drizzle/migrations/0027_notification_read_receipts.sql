-- Per-user read receipts for role-wide and everyone notifications.
-- Keeps one person's "read" action from marking the shared announcement read for colleagues.
CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;

DROP POLICY IF EXISTS "Users read own notification receipts" ON public.notification_reads;
CREATE POLICY "Users read own notification receipts"
  ON public.notification_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users create own notification receipts" ON public.notification_reads;
CREATE POLICY "Users create own notification receipts"
  ON public.notification_reads FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.notifications n WHERE n.id = notification_id)
  );

DROP POLICY IF EXISTS "Users update own notification receipts" ON public.notification_reads;
CREATE POLICY "Users update own notification receipts"
  ON public.notification_reads FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow every signed-in staff member to receive "Everyone" announcements,
-- while role-specific and personal notifications remain scoped to recipients.
DROP POLICY IF EXISTS "Recipient read" ON public.notifications;
CREATE POLICY "Recipient read" ON public.notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (target_role IS NULL AND public.is_staff(auth.uid()))
    OR (target_role IS NOT NULL AND public.has_role(auth.uid(), target_role))
  );

-- Make live updates available where Supabase Realtime is enabled.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = 'notification_reads'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_reads;
    END IF;
  END IF;
END $$;
