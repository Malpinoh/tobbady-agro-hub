-- Preserve farm configuration during operational test-data resets.
-- Also enforce useful activity-log descriptions for new and existing entries.
-- This migration intentionally does not delete or replace any current data.

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
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'ceo'::public.app_role)
    OR public.has_role(auth.uid(), 'administrator'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only the CEO or Administrator can reset test data';
  END IF;

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

  -- Configuration and official records must survive test resets:
  -- breeds, farm_sections, livestock_types/categories, roles/permissions and farms.
  -- Activity logs are operational history; their rows are included in the backup.
  DELETE FROM public.activity_logs WHERE TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_test_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_test_data() TO authenticated;

-- Ensure future activity changes carry a human-readable description.
CREATE OR REPLACE FUNCTION public.log_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_row jsonb;
  new_row jsonb;
  row_data jsonb;
  record_label text;
  changed_fields text;
  verb text;
  table_label text;
  row_id text;
  description_text text;
BEGIN
  old_row := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  new_row := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  row_data := COALESCE(new_row, old_row);
  row_id := COALESCE(row_data->>'id', old_row->>'id', new_row->>'id');

  table_label := CASE TG_TABLE_NAME
    WHEN 'animals' THEN 'individual livestock'
    WHEN 'animal_batches' THEN 'livestock batch'
    WHEN 'batch_movements' THEN 'batch movement'
    WHEN 'inventory_items' THEN 'inventory item'
    WHEN 'inventory_transactions' THEN 'inventory transaction'
    WHEN 'sales' THEN 'sale'
    WHEN 'sale_items' THEN 'sale item'
    WHEN 'expenses' THEN 'expense'
    WHEN 'income' THEN 'income record'
    WHEN 'customers' THEN 'customer'
    WHEN 'suppliers' THEN 'supplier'
    WHEN 'role_permissions' THEN 'role permission'
    WHEN 'user_roles' THEN 'user role'
    WHEN 'profiles' THEN 'user profile'
    ELSE replace(TG_TABLE_NAME, '_', ' ')
  END;

  record_label := COALESCE(
    row_data->>'tag_number',
    row_data->>'batch_code',
    row_data->>'name',
    row_data->>'reference',
    row_data->>'transaction_number',
    row_data->>'id',
    row_id,
    'record'
  );

  verb := CASE lower(TG_OP)
    WHEN 'insert' THEN 'Created'
    WHEN 'update' THEN 'Updated'
    WHEN 'delete' THEN 'Deleted'
    ELSE initcap(lower(TG_OP))
  END;

  IF TG_OP = 'UPDATE' THEN
    SELECT string_agg(key, ', ' ORDER BY key)
      INTO changed_fields
    FROM jsonb_each(COALESCE(new_row, '{}'::jsonb)) AS n(key, value)
    WHERE key NOT IN ('updated_at')
      AND (old_row -> key) IS DISTINCT FROM (new_row -> key);
  END IF;

  description_text := verb || ' ' || table_label || ' (' || record_label || ')';
  IF TG_OP = 'UPDATE' AND COALESCE(changed_fields, '') <> '' THEN
    description_text := description_text || '; changed: ' || changed_fields;
  END IF;

  INSERT INTO public.activity_logs
    (user_id, action, table_name, record_id, old_values, new_values, description)
  VALUES (
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    row_id,
    old_row,
    new_row,
    description_text
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Backfill legacy log rows without descriptions.
UPDATE public.activity_logs
SET description =
  (CASE lower(action)
    WHEN 'insert' THEN 'Created'
    WHEN 'update' THEN 'Updated'
    WHEN 'delete' THEN 'Deleted'
    ELSE initcap(COALESCE(action, 'Changed'))
  END)
  || ' '
  || replace(COALESCE(table_name, 'record'), '_', ' ')
  || CASE
       WHEN record_id IS NOT NULL AND record_id <> ''
       THEN ' (record ' || record_id || ')'
       ELSE ''
     END
WHERE description IS NULL OR btrim(description) = '';
