-- Fix approval trigger record-field access for animals and batches.
-- PL/pgSQL must not evaluate inventory-only fields for other table row types.
CREATE OR REPLACE FUNCTION public.enforce_record_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approver boolean;
  v_inventory_metadata_changed boolean := false;
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
    IF TG_TABLE_NAME = 'inventory_items' THEN
      NEW.submitted_quantity := COALESCE(NEW.quantity_on_hand, 0);
      NEW.quantity_on_hand := 0;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'inventory_items' THEN
    v_inventory_metadata_changed := NEW.submitted_quantity IS DISTINCT FROM OLD.submitted_quantity;
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
      IF TG_TABLE_NAME = 'inventory_items' THEN
        NEW.quantity_on_hand := COALESCE(OLD.submitted_quantity, 0);
      END IF;
    ELSE
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
      IF TG_TABLE_NAME = 'inventory_items' THEN
        NEW.quantity_on_hand := 0;
      END IF;
    END IF;
  ELSIF NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
     OR v_inventory_metadata_changed THEN
    IF NOT v_approver THEN
      RAISE EXCEPTION 'Approval metadata can only be changed by the CEO or Administrator';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
