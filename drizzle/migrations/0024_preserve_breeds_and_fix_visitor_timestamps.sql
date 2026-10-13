-- Protect permanent farm configuration from test-data resets and use server time for visitor events.
-- This migration intentionally preserves all existing breeds and visitor timestamps.

CREATE OR REPLACE FUNCTION public.reset_test_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data jsonb;
  v_backup_id uuid;
  v_expected_counts jsonb;
  v_saved_counts jsonb;
  v_breed_ids_before uuid[];
  v_breed_ids_after uuid[];
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'ceo'::public.app_role)
    OR public.has_role(auth.uid(), 'administrator'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only the CEO or Administrator can reset test data';
  END IF;

  -- Snapshot the exact permanent breed IDs. If a future edit accidentally removes
  -- or changes breed definitions during reset, the exception rolls back the entire reset.
  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[])
    INTO v_breed_ids_before
  FROM public.breeds;

  v_data := public._capture_platform_backup();
  v_expected_counts := public._platform_backup_counts(v_data);

  INSERT INTO public.platform_backups (created_by, reason, source, record_counts, backup_data)
  VALUES (auth.uid(), 'Automatic backup before reset', 'automatic',
          v_expected_counts, v_data)
  RETURNING id INTO v_backup_id;

  SELECT record_counts INTO v_saved_counts
  FROM public.platform_backups
  WHERE id = v_backup_id;

  IF v_saved_counts IS DISTINCT FROM v_expected_counts THEN
    RAISE EXCEPTION 'Automatic backup verification failed; test-data reset cancelled';
  END IF;

  DELETE FROM public.record_change_requests WHERE TRUE;
  DELETE FROM public.batch_movements WHERE TRUE;
  DELETE FROM public.sale_items WHERE TRUE;
  DELETE FROM public.sales WHERE TRUE;
  DELETE FROM public.inventory_transactions WHERE TRUE;
  DELETE FROM public.inventory_items WHERE TRUE;

  -- Break circular expenses/approvals references before deleting either side.
  UPDATE public.expenses SET approval_id = NULL WHERE approval_id IS NOT NULL;
  UPDATE public.executive_approvals SET expense_id = NULL WHERE expense_id IS NOT NULL;
  DELETE FROM public.executive_approvals WHERE TRUE;
  DELETE FROM public.expenses WHERE TRUE;
  DELETE FROM public.income WHERE TRUE;
  DELETE FROM public.animals WHERE TRUE;
  DELETE FROM public.animal_batches WHERE TRUE;
  DELETE FROM public.customers WHERE TRUE;
  DELETE FROM public.suppliers WHERE TRUE;
  DELETE FROM public.employees WHERE TRUE;
  DELETE FROM public.documents WHERE TRUE;
  DELETE FROM public.notifications WHERE TRUE;
  DELETE FROM public.secretary_visitors WHERE TRUE;
  DELETE FROM public.secretary_correspondence WHERE TRUE;
  DELETE FROM public.secretary_meetings WHERE TRUE;

  -- Never delete breeds, farm sections, livestock types/categories, roles/permissions,
  -- farms, or other permanent configuration as part of an operational test reset.
  DELETE FROM public.activity_logs WHERE TRUE;

  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[])
    INTO v_breed_ids_after
  FROM public.breeds;

  IF v_breed_ids_after IS DISTINCT FROM v_breed_ids_before THEN
    RAISE EXCEPTION 'Breed definitions changed during reset; all reset changes have been rolled back';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_test_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_test_data() TO authenticated;

-- Server-authoritative timestamps for visitor check-in and check-out.
CREATE OR REPLACE FUNCTION public.set_secretary_visitor_server_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.arrived_at := clock_timestamp();
    NEW.departed_at := NULL;
    RETURN NEW;
  END IF;

  -- Never allow edits to rewrite a recorded arrival time.
  NEW.arrived_at := OLD.arrived_at;

  -- Stamp the first checkout transition with database server time.
  -- Once checked out, the timestamp is immutable.
  IF OLD.departed_at IS NULL AND NEW.departed_at IS NOT NULL THEN
    NEW.departed_at := clock_timestamp();
  ELSIF OLD.departed_at IS NOT NULL THEN
    NEW.departed_at := OLD.departed_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS secretary_visitors_server_timestamps ON public.secretary_visitors;
CREATE TRIGGER secretary_visitors_server_timestamps
BEFORE INSERT OR UPDATE ON public.secretary_visitors
FOR EACH ROW EXECUTE FUNCTION public.set_secretary_visitor_server_timestamps();

-- Use a server timestamp for checkout without trusting the visitor desk computer's clock.
CREATE OR REPLACE FUNCTION public.checkout_secretary_visitor(p_visitor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT public.has_permission(auth.uid(), 'secretary.view')
    OR NOT (
      public.has_role(auth.uid(), 'secretary'::public.app_role)
      OR public.has_role(auth.uid(), 'ceo'::public.app_role)
      OR public.has_role(auth.uid(), 'administrator'::public.app_role)
    )
  THEN
    RAISE EXCEPTION 'You do not have permission to check out visitors';
  END IF;

  UPDATE public.secretary_visitors
  SET departed_at = clock_timestamp()
  WHERE id = p_visitor_id AND departed_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visitor was not found or has already checked out';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_secretary_visitor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkout_secretary_visitor(uuid) TO authenticated;
