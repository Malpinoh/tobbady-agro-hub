-- Robustly split inventory-only approval fields from animal and batch triggers.
-- Some PostgreSQL trigger-record contexts still resolve NEW.submitted_quantity against
-- the wrong table row type; animal/batch approval must never reference that field.

CREATE OR REPLACE FUNCTION public.enforce_record_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approver boolean;
BEGIN
  v_approver :=
    public.has_role(auth.uid(), 'ceo'::public.app_role)
    OR public.has_role(auth.uid(), 'administrator'::public.app_role);

  IF TG_OP = 'INSERT' THEN
    NEW.approval_status := 'pending';
    NEW.submitted_by := COALESCE(auth.uid(), NEW.submitted_by);
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
    NEW.rejection_reason := NULL;
    RETURN NEW;
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    IF NOT v_approver THEN
      RAISE EXCEPTION 'Only the CEO or Administrator can approve or reject records';
    END IF;
    IF OLD.approval_status <> 'pending' OR NEW.approval_status NOT IN ('approved','rejected') THEN
      RAISE EXCEPTION 'Only pending records can be approved or rejected';
    END IF;
    IF NEW.approval_status = 'approved' THEN
      NEW.approved_by := auth.uid();
      NEW.approved_at := now();
      NEW.rejection_reason := NULL;
    ELSE
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
    END IF;
  ELSIF NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by THEN
    IF NOT v_approver THEN
      RAISE EXCEPTION 'Approval metadata can only be changed by the CEO or Administrator';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_inventory_record_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approver boolean;
BEGIN
  v_approver :=
    public.has_role(auth.uid(), 'ceo'::public.app_role)
    OR public.has_role(auth.uid(), 'administrator'::public.app_role);

  IF TG_OP = 'INSERT' THEN
    NEW.approval_status := 'pending';
    NEW.submitted_by := COALESCE(auth.uid(), NEW.submitted_by);
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
    NEW.rejection_reason := NULL;
    NEW.submitted_quantity := COALESCE(NEW.quantity_on_hand, 0);
    NEW.quantity_on_hand := 0;
    RETURN NEW;
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    IF NOT v_approver THEN
      RAISE EXCEPTION 'Only the CEO or Administrator can approve or reject records';
    END IF;
    IF OLD.approval_status <> 'pending' OR NEW.approval_status NOT IN ('approved','rejected') THEN
      RAISE EXCEPTION 'Only pending records can be approved or rejected';
    END IF;
    IF NEW.approval_status = 'approved' THEN
      NEW.approved_by := auth.uid();
      NEW.approved_at := now();
      NEW.rejection_reason := NULL;
      NEW.quantity_on_hand := COALESCE(OLD.submitted_quantity, 0);
    ELSE
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
      NEW.quantity_on_hand := 0;
    END IF;
  ELSIF NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
     OR NEW.submitted_quantity IS DISTINCT FROM OLD.submitted_quantity THEN
    IF NOT v_approver THEN
      RAISE EXCEPTION 'Approval metadata can only be changed by the CEO or Administrator';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS animals_approval_guard ON public.animals;
CREATE TRIGGER animals_approval_guard
BEFORE INSERT OR UPDATE ON public.animals
FOR EACH ROW EXECUTE FUNCTION public.enforce_record_approval();

DROP TRIGGER IF EXISTS animal_batches_approval_guard ON public.animal_batches;
CREATE TRIGGER animal_batches_approval_guard
BEFORE INSERT OR UPDATE ON public.animal_batches
FOR EACH ROW EXECUTE FUNCTION public.enforce_record_approval();

DROP TRIGGER IF EXISTS inventory_items_approval_guard ON public.inventory_items;
CREATE TRIGGER inventory_items_approval_guard
BEFORE INSERT OR UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_inventory_record_approval();
