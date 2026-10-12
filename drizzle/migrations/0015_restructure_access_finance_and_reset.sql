-- Security, reset-preservation, and livestock-linked finance foundations.
-- New accounts intentionally receive no application role until an executive assigns one.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  -- Deliberately do not insert into user_roles here.
  -- CEO/Administrator must explicitly assign a role after reviewing the signup.
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Admin manages roles" ON public.user_roles;
DROP POLICY IF EXISTS "Executives manage roles" ON public.user_roles;
CREATE POLICY "Executives manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'administrator'::public.app_role)
  OR public.has_role(auth.uid(), 'ceo'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'administrator'::public.app_role)
  OR public.has_role(auth.uid(), 'ceo'::public.app_role)
);

-- Link farm operating costs and other income to the actual livestock records.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS animal_id uuid REFERENCES public.animals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.animal_batches(id) ON DELETE SET NULL;
ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS animal_id uuid REFERENCES public.animals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.animal_batches(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'expenses_single_livestock_link'
      AND conrelid = 'public.expenses'::regclass
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_single_livestock_link
      CHECK (animal_id IS NULL OR batch_id IS NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'income_single_livestock_link'
      AND conrelid = 'public.income'::regclass
  ) THEN
    ALTER TABLE public.income
      ADD CONSTRAINT income_single_livestock_link
      CHECK (animal_id IS NULL OR batch_id IS NULL);
  END IF;
END $$;

-- Reset only operational/test records. Breed definitions are configuration and must survive reset.
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

  v_data := public._capture_platform_backup();
  INSERT INTO public.platform_backups (created_by, reason, source, record_counts, backup_data)
  VALUES (auth.uid(), 'Automatic backup before reset', 'automatic',
          public._platform_backup_counts(v_data), v_data);

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
  DELETE FROM public.farm_sections WHERE TRUE;

  -- IMPORTANT: do not delete public.breeds. Breed definitions are master data.
  -- Original activity logs are preserved in the automatic backup.
  DELETE FROM public.activity_logs WHERE TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_test_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_test_data() TO authenticated;
