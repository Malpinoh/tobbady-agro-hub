-- Add useful, human-readable descriptions to audit/activity log entries.
-- Existing audit rows are backfilled so the Activity Log no longer displays em dashes.

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

-- Backfill existing rows whose trigger did not populate description.
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
