-- Repair audit trigger coverage for operational records and persist useful descriptions.
-- Safe to re-run: triggers are replaced, and existing records are not deleted or rewritten
-- beyond filling blank descriptions.

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'animals', 'animal_batches', 'batch_movements',
    'inventory_items', 'inventory_transactions',
    'sales', 'sale_items', 'expenses', 'income',
    'customers', 'suppliers', 'employees',
    'farms', 'farm_sections', 'livestock_types', 'breeds'
  ] LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_%s ON public.%I', v_table, v_table);
      EXECUTE format(
        'CREATE TRIGGER audit_%s AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_row_change()',
        v_table, v_table
      );
    END IF;
  END LOOP;
END;
$$;

-- Existing rows without a description receive a persistent, readable summary.
-- New writes use log_row_change(), which also records changed field names on updates.
UPDATE public.activity_logs
SET description =
  (CASE lower(COALESCE(action, ''))
    WHEN 'insert' THEN 'Created'
    WHEN 'update' THEN 'Updated'
    WHEN 'delete' THEN 'Deleted'
    ELSE 'Changed'
  END)
  || ' '
  || replace(COALESCE(table_name, 'record'), '_', ' ')
  || CASE
       WHEN record_id IS NOT NULL AND record_id <> ''
       THEN ' (record ' || record_id || ')'
       ELSE ''
     END
WHERE description IS NULL OR btrim(description) = '';
