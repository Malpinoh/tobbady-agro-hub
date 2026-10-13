-- Add an atomic, itemized livestock-sale workflow.
-- Each invoice item is linked to an individual animal or a batch. Stock updates,
-- invoice items, and the payment-ledger trigger run in the same database transaction.

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS unit_cost_at_sale numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS cost_total numeric(14,2)
  GENERATED ALWAYS AS (quantity * unit_cost_at_sale) STORED;

CREATE OR REPLACE FUNCTION public.create_livestock_sale(
  p_customer_id uuid,
  p_sale_date date,
  p_amount_paid numeric,
  p_notes text,
  p_items jsonb
)
RETURNS TABLE (sale_id uuid, invoice_number text, total_amount numeric, amount_paid numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_kind text;
  v_record_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_unit_cost numeric;
  v_type_id uuid;
  v_description text;
  v_animal_status text;
  v_animal_tag text;
  v_batch_code text;
  v_current_quantity integer;
  v_initial_quantity integer;
  v_batch_cost numeric;
  v_total numeric := 0;
  v_paid numeric := COALESCE(p_amount_paid, 0);
  v_sale_id uuid;
  v_invoice_number text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), 'sales.manage') THEN
    RAISE EXCEPTION 'You do not have permission to record sales';
  END IF;

  IF p_sale_date IS NULL THEN
    RAISE EXCEPTION 'Select the sale date';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one livestock item to the sale';
  END IF;

  -- Validate each item and calculate the invoice total before creating records.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_kind := lower(COALESCE(v_item->>'kind', ''));
    v_record_id := NULLIF(v_item->>'record_id', '')::uuid;
    v_quantity := NULLIF(v_item->>'quantity', '')::numeric;
    v_unit_price := NULLIF(v_item->>'unit_price', '')::numeric;

    IF v_record_id IS NULL OR v_unit_price IS NULL OR v_unit_price < 0 THEN
      RAISE EXCEPTION 'Each sale item needs a valid livestock record and unit price';
    END IF;

    IF v_kind = 'animal' THEN
      IF v_quantity IS DISTINCT FROM 1 THEN
        RAISE EXCEPTION 'Individual-animal sale items must have quantity 1';
      END IF;

      SELECT a.status, a.tag_number
      INTO v_animal_status, v_animal_tag
      FROM public.animals a
      WHERE a.id = v_record_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'The selected animal could not be found';
      END IF;
      IF v_animal_status <> 'active' THEN
        RAISE EXCEPTION 'Animal % is not active and cannot be sold', v_animal_tag;
      END IF;
    ELSIF v_kind = 'batch' THEN
      IF v_quantity IS NULL OR v_quantity <= 0 OR v_quantity <> trunc(v_quantity) THEN
        RAISE EXCEPTION 'Batch sale quantity must be a positive whole number';
      END IF;

      SELECT b.current_quantity, b.initial_quantity, b.acquisition_cost, b.batch_code
      INTO v_current_quantity, v_initial_quantity, v_batch_cost, v_batch_code
      FROM public.animal_batches b
      WHERE b.id = v_record_id AND b.status = 'active'
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'The selected batch could not be found or is not active';
      END IF;
      IF v_quantity > v_current_quantity THEN
        RAISE EXCEPTION 'Batch % has only % animals remaining', v_batch_code, v_current_quantity;
      END IF;
    ELSE
      RAISE EXCEPTION 'Sale item kind must be animal or batch';
    END IF;

    v_total := v_total + (v_quantity * v_unit_price);
  END LOOP;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'The total sale amount must be greater than zero';
  END IF;
  IF v_paid < 0 OR v_paid > v_total THEN
    RAISE EXCEPTION 'Initial payment must be between zero and the sale total';
  END IF;

  v_invoice_number := 'TAL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  INSERT INTO public.sales (
    invoice_number, customer_id, sale_date, total_amount, amount_paid,
    payment_status, status, sold_by, notes
  )
  VALUES (
    v_invoice_number, p_customer_id, p_sale_date, v_total, v_paid,
    CASE WHEN v_paid >= v_total THEN 'paid' WHEN v_paid > 0 THEN 'partial' ELSE 'unpaid' END,
    'completed', auth.uid(), NULLIF(btrim(p_notes), '')
  )
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_kind := lower(COALESCE(v_item->>'kind', ''));
    v_record_id := (v_item->>'record_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_price := (v_item->>'unit_price')::numeric;

    IF v_kind = 'animal' THEN
      SELECT a.livestock_type_id, a.acquisition_cost, a.tag_number
      INTO v_type_id, v_unit_cost, v_animal_tag
      FROM public.animals a
      WHERE a.id = v_record_id;

      INSERT INTO public.sale_items (
        sale_id, livestock_type_id, animal_id, description, quantity,
        unit_price, unit_cost_at_sale
      )
      VALUES (
        v_sale_id, v_type_id, v_record_id, 'Animal ' || v_animal_tag,
        1, v_unit_price, COALESCE(v_unit_cost, 0)
      );

      UPDATE public.animals SET status = 'sold', updated_at = now()
      WHERE id = v_record_id AND status = 'active';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Animal % is no longer available for sale', v_animal_tag;
      END IF;
    ELSE
      SELECT b.livestock_type_id, b.initial_quantity, b.acquisition_cost, b.batch_code
      INTO v_type_id, v_initial_quantity, v_batch_cost, v_batch_code
      FROM public.animal_batches b
      WHERE b.id = v_record_id;

      v_unit_cost := CASE
        WHEN COALESCE(v_initial_quantity, 0) > 0
          THEN COALESCE(v_batch_cost, 0) / v_initial_quantity
        ELSE 0
      END;

      INSERT INTO public.sale_items (
        sale_id, livestock_type_id, batch_id, description, quantity,
        unit_price, unit_cost_at_sale
      )
      VALUES (
        v_sale_id, v_type_id, v_record_id, 'Batch ' || v_batch_code,
        v_quantity, v_unit_price, v_unit_cost
      );

      INSERT INTO public.batch_movements (
        batch_id, movement_type, quantity, occurred_on, notes, created_by
      )
      VALUES (
        v_record_id, 'sale', v_quantity::integer, p_sale_date,
        'Sale invoice ' || v_invoice_number, auth.uid()
      );
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_sale_id, v_invoice_number, v_total, v_paid;
END;
$$;

REVOKE ALL ON FUNCTION public.create_livestock_sale(uuid, date, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_livestock_sale(uuid, date, numeric, text, jsonb) TO authenticated;
