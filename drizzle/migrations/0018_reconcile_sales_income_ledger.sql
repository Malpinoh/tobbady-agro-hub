-- Reconcile sales with the income ledger without deleting financial history.
-- Existing income rows that can be matched unambiguously by invoice reference are linked
-- to the sale instead of being duplicated. Ambiguous invoice matches are left untouched
-- and future edits to that sale fail clearly until the ledger is reconciled manually.

-- Link one unassigned "Livestock sales" income row to a sale when the invoice reference
-- identifies exactly one sale and exactly one unassigned income row.
WITH candidate_pairs AS (
  SELECT s.id AS sale_id, i.id AS income_id
  FROM public.sales s
  JOIN public.income i
    ON i.sale_id IS NULL
   AND i.reference = s.invoice_number
   AND lower(btrim(i.category)) = 'livestock sales'
),
unique_pairs AS (
  SELECT cp.sale_id, cp.income_id
  FROM candidate_pairs cp
  WHERE (SELECT count(*) FROM candidate_pairs x WHERE x.sale_id = cp.sale_id) = 1
    AND (SELECT count(*) FROM candidate_pairs x WHERE x.income_id = cp.income_id) = 1
)
UPDATE public.income i
SET sale_id = p.sale_id,
    updated_at = now()
FROM unique_pairs p
WHERE i.id = p.income_id
  AND i.sale_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_sale_payment_to_income()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_income_id uuid;
  v_candidate_count integer;
BEGIN
  IF lower(COALESCE(NEW.status, '')) NOT IN ('cancelled', 'canceled', 'void', 'draft')
     AND COALESCE(NEW.amount_paid, 0) > 0 THEN

    SELECT i.id
      INTO v_income_id
    FROM public.income i
    WHERE i.sale_id = NEW.id
    LIMIT 1;

    IF v_income_id IS NULL THEN
      SELECT count(*)
        INTO v_candidate_count
      FROM public.income i
      WHERE i.sale_id IS NULL
        AND i.reference = NEW.invoice_number
        AND lower(btrim(i.category)) = 'livestock sales';

      IF v_candidate_count > 1 THEN
        RAISE EXCEPTION
          'Cannot sync sale invoice %: multiple unlinked income rows use this invoice reference. Reconcile these rows before updating the sale.',
          NEW.invoice_number;
      ELSIF v_candidate_count = 1 THEN
        UPDATE public.income i
        SET sale_id = NEW.id,
            category = 'Livestock sales',
            amount = NEW.amount_paid,
            received_on = NEW.sale_date,
            description = 'Payment received for invoice ' || NEW.invoice_number,
            reference = NEW.invoice_number,
            recorded_by = NEW.sold_by,
            status = 'received',
            updated_at = now()
        WHERE i.sale_id IS NULL
          AND i.reference = NEW.invoice_number
          AND lower(btrim(i.category)) = 'livestock sales'
        RETURNING i.id INTO v_income_id;
      END IF;
    END IF;

    IF v_income_id IS NOT NULL THEN
      UPDATE public.income
      SET category = 'Livestock sales',
          amount = NEW.amount_paid,
          received_on = NEW.sale_date,
          description = 'Payment received for invoice ' || NEW.invoice_number,
          reference = NEW.invoice_number,
          recorded_by = NEW.sold_by,
          status = 'received',
          updated_at = now()
      WHERE id = v_income_id;
    ELSE
      INSERT INTO public.income (
        sale_id, category, amount, received_on, description, reference, recorded_by, status
      )
      VALUES (
        NEW.id,
        'Livestock sales',
        NEW.amount_paid,
        NEW.sale_date,
        'Payment received for invoice ' || NEW.invoice_number,
        NEW.invoice_number,
        NEW.sold_by,
        'received'
      )
      ON CONFLICT (sale_id) WHERE sale_id IS NOT NULL
      DO UPDATE SET
        category = EXCLUDED.category,
        amount = EXCLUDED.amount,
        received_on = EXCLUDED.received_on,
        description = EXCLUDED.description,
        reference = EXCLUDED.reference,
        recorded_by = EXCLUDED.recorded_by,
        status = 'received',
        updated_at = now();
    END IF;
  ELSE
    -- Keep the financial row for audit purposes; reports already exclude non-received
    -- statuses. Do not physically delete an income record when a sale is cancelled/void.
    UPDATE public.income
    SET status = 'void',
        updated_at = now()
    WHERE sale_id = NEW.id
      AND status <> 'void';
  END IF;

  RETURN NEW;
END;
$$;

-- When a sale itself is deleted, preserve its linked ledger entry as a voided, unlinked
-- record rather than letting the FK silently orphan it without an audit status.
CREATE OR REPLACE FUNCTION public.preserve_deleted_sale_income()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.income
  SET sale_id = NULL,
      status = 'void',
      description = COALESCE(description, '') ||
        CASE WHEN COALESCE(description, '') = '' THEN '' ELSE ' | ' END ||
        'Sale deleted; original invoice ' || OLD.invoice_number,
      updated_at = now()
  WHERE sale_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sales_preserve_income_on_delete ON public.sales;
CREATE TRIGGER sales_preserve_income_on_delete
BEFORE DELETE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.preserve_deleted_sale_income();

DROP TRIGGER IF EXISTS sales_sync_income_ledger ON public.sales;
CREATE TRIGGER sales_sync_income_ledger
AFTER INSERT OR UPDATE OF amount_paid, payment_status, status, total_amount, sale_date
ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.sync_sale_payment_to_income();

-- Bring existing linked rows into line with actual cumulative payments without creating
-- duplicate rows. Cancelled/draft/void sales retain their history but are excluded from
-- recognized income by the existing status filters in dashboard and reports.
UPDATE public.income i
SET amount = s.amount_paid,
    received_on = s.sale_date,
    description = 'Payment received for invoice ' || s.invoice_number,
    reference = s.invoice_number,
    recorded_by = s.sold_by,
    status = CASE
      WHEN lower(COALESCE(s.status, '')) IN ('cancelled', 'canceled', 'void', 'draft')
        OR COALESCE(s.amount_paid, 0) <= 0
      THEN 'void'
      ELSE 'received'
    END,
    updated_at = now()
FROM public.sales s
WHERE i.sale_id = s.id;

-- Backfill only sales with no linked ledger row and no existing ledger row using the
-- invoice reference. This intentionally leaves ambiguous legacy references untouched.
INSERT INTO public.income (
  sale_id, category, amount, received_on, description, reference, recorded_by, status
)
SELECT
  s.id,
  'Livestock sales',
  s.amount_paid,
  s.sale_date,
  'Payment received for invoice ' || s.invoice_number,
  s.invoice_number,
  s.sold_by,
  'received'
FROM public.sales s
WHERE lower(COALESCE(s.status, '')) NOT IN ('cancelled', 'canceled', 'void', 'draft')
  AND COALESCE(s.amount_paid, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.income i WHERE i.sale_id = s.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.income i WHERE i.reference = s.invoice_number
  )
ON CONFLICT (sale_id) WHERE sale_id IS NOT NULL DO NOTHING;

REVOKE ALL ON FUNCTION public.sync_sale_payment_to_income() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preserve_deleted_sale_income() FROM PUBLIC;
