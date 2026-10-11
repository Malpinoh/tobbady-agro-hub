-- Automatic, inspectable backups for the TOBADDY AGRO LIVESTOCK operational-data reset.
-- Backups live in the database and are created in the same transaction before reset.
CREATE TABLE IF NOT EXISTS public.platform_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT 'Manual backup',
  source text NOT NULL DEFAULT 'automatic',
  schema_version integer NOT NULL DEFAULT 1,
  record_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  backup_data jsonb NOT NULL
);

ALTER TABLE public.platform_backups ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.platform_backups TO authenticated;
DROP POLICY IF EXISTS "Executives can view platform backups" ON public.platform_backups;
CREATE POLICY "Executives can view platform backups"
ON public.platform_backups FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'ceo'::public.app_role)
  OR public.has_role(auth.uid(), 'administrator'::public.app_role)
);

CREATE OR REPLACE FUNCTION public._platform_backup_counts(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_table text;
  v_counts jsonb := '{}'::jsonb;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'record_change_requests','batch_movements','sale_items','sales',
    'inventory_transactions','inventory_items','executive_approvals','expenses',
    'income','animals','animal_batches','customers','suppliers','employees',
    'documents','notifications','secretary_visitors','secretary_correspondence',
    'secretary_meetings','breeds','farm_sections','activity_logs'
  ] LOOP
    v_counts := v_counts || jsonb_build_object(
      v_table,
      jsonb_array_length(COALESCE(p_data->v_table, '[]'::jsonb))
    );
  END LOOP;
  RETURN v_counts;
END;
$$;

CREATE OR REPLACE FUNCTION public._capture_platform_backup()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'record_change_requests', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.record_change_requests t), '[]'::jsonb),
    'batch_movements', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.batch_movements t), '[]'::jsonb),
    'sale_items', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.sale_items t), '[]'::jsonb),
    'sales', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.sales t), '[]'::jsonb),
    'inventory_transactions', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.inventory_transactions t), '[]'::jsonb),
    'inventory_items', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.inventory_items t), '[]'::jsonb),
    'executive_approvals', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.executive_approvals t), '[]'::jsonb),
    'expenses', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.expenses t), '[]'::jsonb),
    'income', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.income t), '[]'::jsonb),
    'animals', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.animals t), '[]'::jsonb),
    'animal_batches', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.animal_batches t), '[]'::jsonb),
    'customers', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.customers t), '[]'::jsonb),
    'suppliers', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.suppliers t), '[]'::jsonb),
    'employees', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.employees t), '[]'::jsonb),
    'documents', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.documents t), '[]'::jsonb),
    'notifications', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.notifications t), '[]'::jsonb),
    'secretary_visitors', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.secretary_visitors t), '[]'::jsonb),
    'secretary_correspondence', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.secretary_correspondence t), '[]'::jsonb),
    'secretary_meetings', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.secretary_meetings t), '[]'::jsonb),
    'breeds', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.breeds t), '[]'::jsonb),
    'farm_sections', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.farm_sections t), '[]'::jsonb),
    'activity_logs', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM public.activity_logs t), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.create_platform_backup(p_reason text DEFAULT 'Manual backup')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data jsonb;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'ceo'::public.app_role)
    OR public.has_role(auth.uid(), 'administrator'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only the CEO or Administrator can create backups';
  END IF;

  v_data := public._capture_platform_backup();
  INSERT INTO public.platform_backups (created_by, reason, source, record_counts, backup_data)
  VALUES (auth.uid(), COALESCE(NULLIF(trim(p_reason), ''), 'Manual backup'),
          'manual', public._platform_backup_counts(v_data), v_data)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_platform_backup(p_backup jsonb, p_reason text DEFAULT 'Imported backup')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data jsonb;
  v_table text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'ceo'::public.app_role)
    OR public.has_role(auth.uid(), 'administrator'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only the CEO or Administrator can import backups';
  END IF;
  IF jsonb_typeof(p_backup) <> 'object'
     OR p_backup->>'format' <> 'tobbady-agro-livestock-backup'
     OR (p_backup->>'version')::integer IS DISTINCT FROM 1
     OR jsonb_typeof(p_backup->'data') <> 'object' THEN
    RAISE EXCEPTION 'This is not a supported TOBADDY AGRO LIVESTOCK backup file';
  END IF;

  v_data := p_backup->'data';
  FOREACH v_table IN ARRAY ARRAY[
    'record_change_requests','batch_movements','sale_items','sales',
    'inventory_transactions','inventory_items','executive_approvals','expenses',
    'income','animals','animal_batches','customers','suppliers','employees',
    'documents','notifications','secretary_visitors','secretary_correspondence',
    'secretary_meetings','breeds','farm_sections','activity_logs'
  ] LOOP
    IF jsonb_typeof(v_data->v_table) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Backup is missing a valid "%" array', v_table;
    END IF;
  END LOOP;

  INSERT INTO public.platform_backups (created_by, reason, source, schema_version, record_counts, backup_data)
  VALUES (auth.uid(), COALESCE(NULLIF(trim(p_reason), ''), 'Imported backup'),
          'imported', 1, public._platform_backup_counts(v_data), v_data)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Insert a JSON array into one allow-listed table, skipping generated columns.
CREATE OR REPLACE FUNCTION public._restore_platform_backup_table(
  p_table text,
  p_rows jsonb,
  p_skip_columns text[] DEFAULT ARRAY[]::text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_columns text;
  v_rows jsonb;
BEGIN
  IF p_table NOT IN (
    'record_change_requests','batch_movements','sale_items','sales',
    'inventory_transactions','inventory_items','executive_approvals','expenses',
    'income','animals','animal_batches','customers','suppliers','employees',
    'documents','notifications','secretary_visitors','secretary_correspondence',
    'secretary_meetings','breeds','farm_sections','activity_logs'
  ) THEN
    RAISE EXCEPTION 'Table is not allowed in a platform backup';
  END IF;
  IF COALESCE(jsonb_array_length(p_rows), 0) = 0 THEN
    RETURN;
  END IF;

  SELECT string_agg(format('%I', c.column_name), ', ' ORDER BY c.ordinal_position)
  INTO v_columns
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = p_table
    AND c.is_generated = 'NEVER'
    AND NOT (c.column_name = ANY(p_skip_columns));

  SELECT COALESCE(jsonb_agg(item - p_skip_columns), '[]'::jsonb)
  INTO v_rows
  FROM jsonb_array_elements(p_rows) AS item;

  EXECUTE format(
    'INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT DO NOTHING',
    p_table, v_columns, v_columns, p_table
  ) USING v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_test_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'ceo'::public.app_role)
    OR public.has_role(auth.uid(), 'administrator'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only the CEO or Administrator can reset test data';
  END IF;

  -- Snapshot first. Because this is one transaction, reset aborts if backup creation fails.
  v_data := public._capture_platform_backup();
  INSERT INTO public.platform_backups (created_by, reason, source, record_counts, backup_data)
  VALUES (auth.uid(), 'Automatic backup before reset', 'automatic',
          public._platform_backup_counts(v_data), v_data);

  DELETE FROM public.record_change_requests;
  DELETE FROM public.batch_movements;
  DELETE FROM public.sale_items;
  DELETE FROM public.sales;
  DELETE FROM public.inventory_transactions;
  DELETE FROM public.inventory_items;

  -- Break the circular expenses/approvals references before deleting either side.
  UPDATE public.expenses SET approval_id = NULL WHERE approval_id IS NOT NULL;
  UPDATE public.executive_approvals SET expense_id = NULL WHERE expense_id IS NOT NULL;
  DELETE FROM public.executive_approvals;
  DELETE FROM public.expenses;
  DELETE FROM public.income;
  DELETE FROM public.animals;
  DELETE FROM public.animal_batches;
  DELETE FROM public.customers;
  DELETE FROM public.suppliers;
  DELETE FROM public.employees;
  DELETE FROM public.documents;
  DELETE FROM public.notifications;
  DELETE FROM public.secretary_visitors;
  DELETE FROM public.secretary_correspondence;
  DELETE FROM public.secretary_meetings;
  DELETE FROM public.breeds;
  DELETE FROM public.farm_sections;

  -- Remove reset-generated audit entries; the original logs are preserved in the backup.
  DELETE FROM public.activity_logs;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_platform_backup(p_backup_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data jsonb;
  v_current jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'ceo'::public.app_role)
    OR public.has_role(auth.uid(), 'administrator'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only the CEO or Administrator can restore backups';
  END IF;

  SELECT backup_data INTO v_data
  FROM public.platform_backups
  WHERE id = p_backup_id;
  IF v_data IS NULL THEN
    RAISE EXCEPTION 'Backup not found';
  END IF;

  -- Preserve current operational data before replacing it.
  v_current := public._capture_platform_backup();
  INSERT INTO public.platform_backups (created_by, reason, source, record_counts, backup_data)
  VALUES (auth.uid(), 'Safety backup before restore', 'automatic',
          public._platform_backup_counts(v_current), v_current);

  DELETE FROM public.record_change_requests;
  DELETE FROM public.batch_movements;
  DELETE FROM public.sale_items;
  DELETE FROM public.sales;
  DELETE FROM public.inventory_transactions;
  DELETE FROM public.inventory_items;
  UPDATE public.expenses SET approval_id = NULL WHERE approval_id IS NOT NULL;
  UPDATE public.executive_approvals SET expense_id = NULL WHERE expense_id IS NOT NULL;
  DELETE FROM public.executive_approvals;
  DELETE FROM public.expenses;
  DELETE FROM public.income;
  DELETE FROM public.animals;
  DELETE FROM public.animal_batches;
  DELETE FROM public.customers;
  DELETE FROM public.suppliers;
  DELETE FROM public.employees;
  DELETE FROM public.documents;
  DELETE FROM public.notifications;
  DELETE FROM public.secretary_visitors;
  DELETE FROM public.secretary_correspondence;
  DELETE FROM public.secretary_meetings;
  DELETE FROM public.breeds;
  DELETE FROM public.farm_sections;
  DELETE FROM public.activity_logs;

  -- Parents before children. The circular expense/approval links are restored after both sides exist.
  PERFORM public._restore_platform_backup_table('farm_sections', v_data->'farm_sections');
  PERFORM public._restore_platform_backup_table('breeds', v_data->'breeds');
  PERFORM public._restore_platform_backup_table('customers', v_data->'customers');
  PERFORM public._restore_platform_backup_table('suppliers', v_data->'suppliers');
  PERFORM public._restore_platform_backup_table('employees', v_data->'employees');
  PERFORM public._restore_platform_backup_table('animals', v_data->'animals');
  PERFORM public._restore_platform_backup_table('animal_batches', v_data->'animal_batches');
  PERFORM public._restore_platform_backup_table('income', v_data->'income');
  PERFORM public._restore_platform_backup_table('expenses', v_data->'expenses', ARRAY['approval_id']);
  PERFORM public._restore_platform_backup_table('sales', v_data->'sales');
  PERFORM public._restore_platform_backup_table('inventory_items', v_data->'inventory_items');
  PERFORM public._restore_platform_backup_table('executive_approvals', v_data->'executive_approvals', ARRAY['expense_id']);

  UPDATE public.expenses e
  SET approval_id = NULLIF(item->>'approval_id', '')::uuid
  FROM jsonb_array_elements(v_data->'expenses') item
  WHERE e.id = (item->>'id')::uuid
    AND NULLIF(item->>'approval_id', '') IS NOT NULL;

  UPDATE public.executive_approvals a
  SET expense_id = NULLIF(item->>'expense_id', '')::uuid
  FROM jsonb_array_elements(v_data->'executive_approvals') item
  WHERE a.id = (item->>'id')::uuid
    AND NULLIF(item->>'expense_id', '') IS NOT NULL;

  PERFORM public._restore_platform_backup_table('sale_items', v_data->'sale_items');
  PERFORM public._restore_platform_backup_table('inventory_transactions', v_data->'inventory_transactions');
  PERFORM public._restore_platform_backup_table('batch_movements', v_data->'batch_movements');
  PERFORM public._restore_platform_backup_table('record_change_requests', v_data->'record_change_requests');
  PERFORM public._restore_platform_backup_table('documents', v_data->'documents');
  PERFORM public._restore_platform_backup_table('notifications', v_data->'notifications');
  PERFORM public._restore_platform_backup_table('secretary_visitors', v_data->'secretary_visitors');
  PERFORM public._restore_platform_backup_table('secretary_correspondence', v_data->'secretary_correspondence');
  PERFORM public._restore_platform_backup_table('secretary_meetings', v_data->'secretary_meetings');
  PERFORM public._restore_platform_backup_table('activity_logs', v_data->'activity_logs');
END;
$$;

REVOKE ALL ON FUNCTION public._platform_backup_counts(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._capture_platform_backup() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._restore_platform_backup_table(text, jsonb, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_platform_backup(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_platform_backup(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_platform_backup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_platform_backup(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_platform_backup(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_platform_backup(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.reset_test_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_test_data() TO authenticated;
