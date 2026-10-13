-- Record procurement receipts and update stock atomically.
-- Keep the existing inventory movement RPC unchanged for inventory workflows.
CREATE OR REPLACE FUNCTION public.record_procurement_receipt(
  p_item_id uuid,
  p_quantity numeric,
  p_unit_cost numeric DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
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
     OR NOT (
       public.has_permission(auth.uid(), 'inventory.manage')
       OR public.has_permission(auth.uid(), 'procurement.manage')
       OR public.has_permission(auth.uid(), 'finance.manage')
     ) THEN
    RAISE EXCEPTION 'You do not have permission to record procurement receipts';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Receipt quantity must be greater than zero';
  END IF;
  IF p_unit_cost IS NOT NULL AND p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Unit cost cannot be negative';
  END IF;

  SELECT quantity_on_hand, approval_status
    INTO v_current_quantity, v_approval_status
    FROM public.inventory_items
    WHERE id = p_item_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;
  IF v_approval_status <> 'approved' THEN
    RAISE EXCEPTION 'This inventory item must be approved before stock can be received';
  END IF;

  UPDATE public.inventory_items
  SET quantity_on_hand = quantity_on_hand + p_quantity,
      unit_cost = CASE WHEN p_unit_cost IS NOT NULL THEN p_unit_cost ELSE unit_cost END,
      updated_at = now()
  WHERE id = p_item_id;

  INSERT INTO public.inventory_transactions (
    item_id, transaction_type, quantity, supplier_id, unit_cost,
    reference, notes, performed_by, occurred_at
  ) VALUES (
    p_item_id, 'received', p_quantity, p_supplier_id, p_unit_cost,
    NULLIF(trim(p_reference), ''),
    NULLIF(trim(p_notes), ''),
    auth.uid(), now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_procurement_receipt(uuid, numeric, numeric, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_procurement_receipt(uuid, numeric, numeric, uuid, text, text) TO authenticated;
