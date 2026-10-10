-- Approval workflow for new livestock and inventory records.
-- Existing records remain approved; new records are forced to pending by triggers.
ALTER TABLE public.animals
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.animal_batches
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS submitted_quantity numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

UPDATE public.animals SET approval_status = 'approved', approved_at = COALESCE(approved_at, created_at)
WHERE approval_status IS NULL OR approval_status = 'approved';
UPDATE public.animal_batches SET approval_status = 'approved', approved_at = COALESCE(approved_at, created_at)
WHERE approval_status IS NULL OR approval_status = 'approved';
UPDATE public.inventory_items
SET approval_status = 'approved',
    submitted_quantity = quantity_on_hand,
    approved_at = COALESCE(approved_at, created_at)
WHERE approval_status IS NULL OR approval_status = 'approved';

ALTER TABLE public.animals ALTER COLUMN approval_status SET DEFAULT 'pending';
ALTER TABLE public.animal_batches ALTER COLUMN approval_status SET DEFAULT 'pending';
ALTER TABLE public.inventory_items ALTER COLUMN approval_status SET DEFAULT 'pending';

ALTER TABLE public.animals DROP CONSTRAINT IF EXISTS animals_approval_status_check;
ALTER TABLE public.animals ADD CONSTRAINT animals_approval_status_check CHECK (approval_status IN ('pending','approved','rejected'));
ALTER TABLE public.animal_batches DROP CONSTRAINT IF EXISTS animal_batches_approval_status_check;
ALTER TABLE public.animal_batches ADD CONSTRAINT animal_batches_approval_status_check CHECK (approval_status IN ('pending','approved','rejected'));
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_approval_status_check;
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_approval_status_check CHECK (approval_status IN ('pending','approved','rejected'));

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
    IF TG_TABLE_NAME = 'inventory_items' THEN
      NEW.submitted_quantity := COALESCE(NEW.quantity_on_hand, 0);
      NEW.quantity_on_hand := 0;
    END IF;
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
     OR (TG_TABLE_NAME = 'inventory_items' AND NEW.submitted_quantity IS DISTINCT FROM OLD.submitted_quantity) THEN
    IF NOT v_approver THEN
      RAISE EXCEPTION 'Approval metadata can only be changed by the CEO or Administrator';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS animals_approval_guard ON public.animals;
CREATE TRIGGER animals_approval_guard BEFORE INSERT OR UPDATE ON public.animals
FOR EACH ROW EXECUTE FUNCTION public.enforce_record_approval();
DROP TRIGGER IF EXISTS animal_batches_approval_guard ON public.animal_batches;
CREATE TRIGGER animal_batches_approval_guard BEFORE INSERT OR UPDATE ON public.animal_batches
FOR EACH ROW EXECUTE FUNCTION public.enforce_record_approval();
DROP TRIGGER IF EXISTS inventory_items_approval_guard ON public.inventory_items;
CREATE TRIGGER inventory_items_approval_guard BEFORE INSERT OR UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_record_approval();

CREATE INDEX IF NOT EXISTS animals_approval_status_idx ON public.animals (approval_status);
CREATE INDEX IF NOT EXISTS animal_batches_approval_status_idx ON public.animal_batches (approval_status);
CREATE INDEX IF NOT EXISTS inventory_items_approval_status_idx ON public.inventory_items (approval_status);

-- Pending inventory items cannot receive or use stock until approved.
CREATE OR REPLACE FUNCTION public.record_inventory_movement(
  p_item_id uuid,
  p_transaction_type text,
  p_quantity numeric,
  p_unit_cost numeric DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_quantity numeric(14,2);
  v_approval_status text;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_permission(auth.uid(), 'inventory.manage') THEN
    RAISE EXCEPTION 'You do not have permission to manage inventory';
  END IF;
  IF p_transaction_type NOT IN ('received', 'used', 'count_increase', 'count_decrease') THEN
    RAISE EXCEPTION 'Invalid inventory transaction type';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Movement quantity must be greater than zero';
  END IF;
  IF p_unit_cost IS NOT NULL AND p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Unit cost cannot be negative';
  END IF;

  SELECT quantity_on_hand, approval_status
    INTO v_current_quantity, v_approval_status
    FROM public.inventory_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item not found'; END IF;
  IF v_approval_status <> 'approved' THEN
    RAISE EXCEPTION 'This inventory item must be approved before stock movements can be recorded';
  END IF;
  IF p_transaction_type IN ('used', 'count_decrease') AND v_current_quantity < p_quantity THEN
    RAISE EXCEPTION 'There is not enough stock for this movement';
  END IF;

  UPDATE public.inventory_items
  SET quantity_on_hand = CASE
        WHEN p_transaction_type IN ('received', 'count_increase') THEN quantity_on_hand + p_quantity
        ELSE quantity_on_hand - p_quantity
      END,
      unit_cost = CASE WHEN p_transaction_type = 'received' AND p_unit_cost IS NOT NULL THEN p_unit_cost ELSE unit_cost END,
      updated_at = now()
  WHERE id = p_item_id;

  INSERT INTO public.inventory_transactions (
    item_id, transaction_type, quantity, unit_cost, reference, notes, performed_by, occurred_at
  ) VALUES (
    p_item_id, p_transaction_type, p_quantity, p_unit_cost,
    NULLIF(trim(p_reference), ''), NULLIF(trim(p_notes), ''), auth.uid(), now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_inventory_movement(uuid, text, numeric, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_inventory_movement(uuid, text, numeric, numeric, text, text) TO authenticated;

-- Allow CEO/Administrator approval even when they do not hold the operational manage permission.
DROP POLICY IF EXISTS "CEO admin approve animals" ON public.animals;
CREATE POLICY "CEO admin approve animals" ON public.animals FOR UPDATE TO authenticated
USING (approval_status = 'pending' AND (public.has_role(auth.uid(),'ceo'::public.app_role) OR public.has_role(auth.uid(),'administrator'::public.app_role)))
WITH CHECK (public.has_role(auth.uid(),'ceo'::public.app_role) OR public.has_role(auth.uid(),'administrator'::public.app_role));
DROP POLICY IF EXISTS "CEO admin approve batches" ON public.animal_batches;
CREATE POLICY "CEO admin approve batches" ON public.animal_batches FOR UPDATE TO authenticated
USING (approval_status = 'pending' AND (public.has_role(auth.uid(),'ceo'::public.app_role) OR public.has_role(auth.uid(),'administrator'::public.app_role)))
WITH CHECK (public.has_role(auth.uid(),'ceo'::public.app_role) OR public.has_role(auth.uid(),'administrator'::public.app_role));
DROP POLICY IF EXISTS "CEO admin approve inventory" ON public.inventory_items;
CREATE POLICY "CEO admin approve inventory" ON public.inventory_items FOR UPDATE TO authenticated
USING (approval_status = 'pending' AND (public.has_role(auth.uid(),'ceo'::public.app_role) OR public.has_role(auth.uid(),'administrator'::public.app_role)))
WITH CHECK (public.has_role(auth.uid(),'ceo'::public.app_role) OR public.has_role(auth.uid(),'administrator'::public.app_role));
