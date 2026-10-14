-- Track which animal or livestock batch received feed when stock is used.
ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS animal_id uuid REFERENCES public.animals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.animal_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inventory_transactions_animal_idx
  ON public.inventory_transactions(animal_id) WHERE animal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_transactions_batch_idx
  ON public.inventory_transactions(batch_id) WHERE batch_id IS NOT NULL;

-- Replace the old function with an extended version that records attribution
-- without changing the existing stock arithmetic or permission requirement.
DROP FUNCTION IF EXISTS public.record_inventory_movement(uuid, text, numeric, numeric, text, text);

CREATE FUNCTION public.record_inventory_movement(
  p_item_id uuid,
  p_transaction_type text,
  p_quantity numeric,
  p_unit_cost numeric DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_animal_id uuid DEFAULT NULL,
  p_batch_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_quantity numeric(14,2);
  v_approval_status text;
  v_item_category text;
  v_item_unit text;
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
  IF p_animal_id IS NOT NULL AND p_batch_id IS NOT NULL THEN
    RAISE EXCEPTION 'Choose an individual animal or a batch, not both';
  END IF;
  IF (p_animal_id IS NOT NULL OR p_batch_id IS NOT NULL)
     AND (p_transaction_type <> 'used') THEN
    RAISE EXCEPTION 'Animals and batches can only be assigned to feed usage';
  END IF;

  SELECT quantity_on_hand, approval_status, category, unit
    INTO v_current_quantity, v_approval_status, v_item_category, v_item_unit
    FROM public.inventory_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item not found'; END IF;
  IF v_approval_status <> 'approved' THEN
    RAISE EXCEPTION 'This inventory item must be approved before stock movements can be recorded';
  END IF;
  IF p_transaction_type IN ('used', 'count_decrease') AND v_current_quantity < p_quantity THEN
    RAISE EXCEPTION 'There is not enough stock for this movement';
  END IF;
  IF (p_animal_id IS NOT NULL OR p_batch_id IS NOT NULL)
     AND (lower(trim(coalesce(v_item_category,''))) <> 'feed'
          OR lower(trim(coalesce(v_item_unit,''))) <> 'kg') THEN
    RAISE EXCEPTION 'Animal or batch attribution is only available for Feed items measured in kg';
  END IF;
  IF p_animal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.animals WHERE id = p_animal_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Choose an active individual animal';
  END IF;
  IF p_batch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.animal_batches WHERE id = p_batch_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Choose an active livestock batch';
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
    item_id, transaction_type, quantity, unit_cost, reference, notes, performed_by,
    occurred_at, animal_id, batch_id
  ) VALUES (
    p_item_id, p_transaction_type, p_quantity, p_unit_cost,
    NULLIF(trim(p_reference), ''), NULLIF(trim(p_notes), ''), auth.uid(),
    now(), p_animal_id, p_batch_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_inventory_movement(uuid, text, numeric, numeric, text, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_inventory_movement(uuid, text, numeric, numeric, text, text, uuid, uuid) TO authenticated;
