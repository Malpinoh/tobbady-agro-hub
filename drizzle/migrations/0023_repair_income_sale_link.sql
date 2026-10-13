-- Repair the sales-to-income link when earlier finance migrations were not applied.
-- Safe to rerun: preserve existing ledger rows and never delete financial history.

ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS sale_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.income'::regclass
      AND conname = 'income_sale_id_fkey'
  ) THEN
    ALTER TABLE public.income
      ADD CONSTRAINT income_sale_id_fkey
      FOREIGN KEY (sale_id) REFERENCES public.sales(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS income_sale_id_unique
  ON public.income (sale_id)
  WHERE sale_id IS NOT NULL;

-- Link historical income to sales only where invoice, amount, category, and match
-- uniqueness all agree. Ambiguous or unmatched ledger history is left untouched.
WITH candidate_pairs AS (
  SELECT s.id AS sale_id, i.id AS income_id
  FROM public.sales s
  JOIN public.income i
    ON i.sale_id IS NULL
   AND i.reference = s.invoice_number
   AND i.amount = s.amount_paid
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

    SELECT i.id INTO v_income_id
    FROM public.income i
    WHERE i.sale_id = NEW.id
    LIMIT 1;

    IF v_income_id IS NULL THEN
      SELECT count(*) INTO v_candidate_count
      FROM public.income i
      WHERE i.sale_id IS NULL
        AND i.reference = NEW.invoice_number
        AND i.amount = NEW.amount_paid
        AND lower(btrim(i.category)) = 'livestock sales';

      IF v_candidate_count > 1 THEN
        RAISE EXCEPTION
          'Cannot sync sale invoice %: multiple unlinked income rows use this invoice reference. Reconcile these rows before updating the sale.',
          NEW.invoice_number;
      ELSIF v_candidate_count = 0 AND EXISTS (
        SELECT 1 FROM public.income i
        WHERE i.sale_id IS NULL AND i.reference = NEW.invoice_number
      ) THEN
        RAISE EXCEPTION
          'Cannot sync sale invoice %: an existing unlinked income row uses this invoice reference but does not match the payment amount/category. Reconcile it manually to avoid overwriting or duplicating financial history.',
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
          AND i.amount = NEW.amount_paid
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
        NEW.id, 'Livestock sales', NEW.amount_paid, NEW.sale_date,
        'Payment received for invoice ' || NEW.invoice_number,
        NEW.invoice_number, NEW.sold_by, 'received'
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
    UPDATE public.income
    SET status = 'void', updated_at = now()
    WHERE sale_id = NEW.id AND status <> 'void';
  END IF;

  RETURN NEW;
END;
$$;

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
FOR EACH ROW EXECUTE FUNCTION public.preserve_deleted_sale_income();

DROP TRIGGER IF EXISTS sales_sync_income_ledger ON public.sales;
CREATE TRIGGER sales_sync_income_ledger
AFTER INSERT OR UPDATE OF amount_paid, payment_status, status, total_amount, sale_date
ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.sync_sale_payment_to_income();

-- Backfill only sales with no linked ledger row and no income row already using
-- that invoice reference. Existing unmatched financial history is never overwritten.
INSERT INTO public.income (
  sale_id, category, amount, received_on, description, reference, recorded_by, status
)
SELECT s.id, 'Livestock sales', s.amount_paid, s.sale_date,
       'Payment received for invoice ' || s.invoice_number,
       s.invoice_number, s.sold_by, 'received'
FROM public.sales s
WHERE lower(COALESCE(s.status, '')) NOT IN ('cancelled', 'canceled', 'void', 'draft')
  AND COALESCE(s.amount_paid, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.income i WHERE i.sale_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.income i WHERE i.reference = s.invoice_number)
ON CONFLICT (sale_id) WHERE sale_id IS NOT NULL DO NOTHING;

REVOKE ALL ON FUNCTION public.sync_sale_payment_to_income() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preserve_deleted_sale_income() FROM PUBLIC;
