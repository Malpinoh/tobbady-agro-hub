-- Require Administrator/CEO approval before a Secretary can delete business records.
-- A blocked DELETE is recorded as a request; the original row remains untouched.
CREATE TABLE IF NOT EXISTS public.secretary_delete_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  record_label text NOT NULL,
  record_snapshot jsonb NOT NULL,
  reason text NOT NULL DEFAULT 'Deletion requested from the record page',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text
);
CREATE INDEX IF NOT EXISTS secretary_delete_requests_pending_idx
  ON public.secretary_delete_requests(status, requested_at DESC);
ALTER TABLE public.secretary_delete_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Executives review secretary deletion requests" ON public.secretary_delete_requests;
CREATE POLICY "Executives review secretary deletion requests"
  ON public.secretary_delete_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'administrator'::public.app_role)
      OR public.has_role(auth.uid(),'ceo'::public.app_role));
DROP POLICY IF EXISTS "Secretary views own deletion requests" ON public.secretary_delete_requests;
CREATE POLICY "Secretary views own deletion requests"
  ON public.secretary_delete_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.secretary_delete_requests FROM authenticated;

CREATE OR REPLACE FUNCTION public.guard_secretary_record_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb := to_jsonb(OLD);
  v_id uuid;
  v_label text;
BEGIN
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'secretary'::public.app_role) THEN
    IF v_row->>'id' IS NULL THEN
      RAISE EXCEPTION 'This record cannot be deleted by a Secretary. Ask the Administrator to review it.';
    END IF;
    v_id := (v_row->>'id')::uuid;
    v_label := COALESCE(
      v_row->>'tag_number', v_row->>'batch_code', v_row->>'name',
      v_row->>'title', v_row->>'reference_number', v_row->>'code',
      v_row->>'full_name', v_row->>'description', TG_TABLE_NAME || ' record'
    );
    INSERT INTO public.secretary_delete_requests
      (table_name, record_id, record_label, record_snapshot, requested_by)
    VALUES (TG_TABLE_NAME, v_id, v_label, v_row, auth.uid());
    -- Suppress the actual delete. The row remains until an authorized review.
    RETURN NULL;
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_secretary_record_delete() FROM PUBLIC;

-- Install the database-level guard on business records. Security/access tables,
-- backups, and approval/audit tables are deliberately excluded from generic deletion.
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'animals','animal_batches','inventory_items','inventory_transactions',
    'sales','sale_items','income','expenses','customers','suppliers','employees',
    'documents','notifications','secretary_visitors','secretary_correspondence',
    'secretary_meetings','breeds','farm_sections','farms','livestock_categories',
    'livestock_types','batch_movements'
  ] LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS secretary_delete_approval_guard ON public.%I', v_table);
      EXECUTE format(
        'CREATE TRIGGER secretary_delete_approval_guard BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_secretary_record_delete()',
        v_table
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_secretary_delete_request(
  p_request_id uuid,
  p_decision text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.secretary_delete_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(),'administrator'::public.app_role)
    OR public.has_role(auth.uid(),'ceo'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only the Administrator or CEO can review deletion requests';
  END IF;
  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Choose approve or reject';
  END IF;

  SELECT * INTO r FROM public.secretary_delete_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deletion request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'This request has already been reviewed'; END IF;

  IF p_decision = 'approved' THEN
    -- A fixed whitelist prevents a request from selecting an arbitrary table.
    IF r.table_name NOT IN (
      'animals','animal_batches','inventory_items','inventory_transactions',
      'sales','sale_items','income','expenses','customers','suppliers','employees',
      'documents','notifications','secretary_visitors','secretary_correspondence',
      'secretary_meetings','breeds','farm_sections','farms','livestock_categories',
      'livestock_types','batch_movements'
    ) THEN
      RAISE EXCEPTION 'This type of record needs a separate administrator action';
    END IF;
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', r.table_name) USING r.record_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The record no longer exists; no deletion was performed';
    END IF;
  END IF;

  UPDATE public.secretary_delete_requests
  SET status=p_decision, reviewed_by=auth.uid(), reviewed_at=now(),
      rejection_reason=CASE WHEN p_decision='rejected' THEN NULLIF(trim(p_rejection_reason),'') ELSE NULL END
  WHERE id=r.id;
END;
$$;
REVOKE ALL ON FUNCTION public.review_secretary_delete_request(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_secretary_delete_request(uuid,text,text) TO authenticated;
