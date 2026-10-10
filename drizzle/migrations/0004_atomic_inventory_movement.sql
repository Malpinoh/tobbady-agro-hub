
-- Atomically update inventory stock and record its movement.
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
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_permission(auth.uid(), 'inventory.manage') THEN
    RAISE EXCEPTION 'You do not have permission to manage inventory';
  END IF;

  IF p_transaction_type NOT IN (
    'received', 'used', 'count_increase', 'count_decrease'
  ) THEN
    RAISE EXCEPTION 'Invalid inventory transaction type';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Movement quantity must be greater than zero';
  END IF;

  IF p_unit_cost IS NOT NULL AND p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Unit cost cannot be negative';
  END IF;

  SELECT quantity_on_hand
  INTO v_current_quantity
  FROM public.inventory_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;

  IF p_transaction_type IN ('used', 'count_decrease')
     AND v_current_quantity < p_quantity THEN
    RAISE EXCEPTION 'There is not enough stock for this movement';
  END IF;

  UPDATE public.inventory_items
  SET quantity_on_hand = CASE
        WHEN p_transaction_type IN ('received', 'count_increase')
          THEN quantity_on_hand + p_quantity
        ELSE quantity_on_hand - p_quantity
      END,
      unit_cost = CASE
        WHEN p_transaction_type = 'received' AND p_unit_cost IS NOT NULL
          THEN p_unit_cost
        ELSE unit_cost
      END,
      updated_at = now()
  WHERE id = p_item_id;

  INSERT INTO public.inventory_transactions (
    item_id, transaction_type, quantity, unit_cost,
    reference, notes, performed_by, occurred_at
  ) VALUES (
    p_item_id, p_transaction_type, p_quantity, p_unit_cost,
    NULLIF(trim(p_reference), ''),
    NULLIF(trim(p_notes), ''),
    auth.uid(), now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_inventory_movement(
  uuid, text, numeric, numeric, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_inventory_movement(
  uuid, text, numeric, numeric, text, text
) TO authenticated;
