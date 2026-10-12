-- Keep the finance ledger connected to livestock sales without counting sales twice.
ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;

-- Restore imports may insert income rows before sales rows in the same transaction.
-- Defer this FK check until the sale row has been restored.
ALTER TABLE public.income
  ALTER CONSTRAINT income_sale_id_fkey DEFERRABLE INITIALLY DEFERRED;

CREATE UNIQUE INDEX IF NOT EXISTS income_sale_id_unique
  ON public.income (sale_id)
  WHERE sale_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_sale_payment_to_income()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(COALESCE(NEW.status, '')) NOT IN ('cancelled', 'canceled', 'void', 'draft')
     AND COALESCE(NEW.amount_paid, 0) > 0 THEN
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
      status = 'received';
  ELSE
    DELETE FROM public.income WHERE sale_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_sync_income_ledger ON public.sales;
CREATE TRIGGER sales_sync_income_ledger
AFTER INSERT OR UPDATE OF amount_paid, payment_status, status, total_amount, sale_date
ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.sync_sale_payment_to_income();

-- Backfill prior sales only when an equivalent invoice receipt is not already in the ledger.
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
    SELECT 1
    FROM public.income i
    WHERE i.sale_id = s.id
       OR (i.reference = s.invoice_number AND i.amount = s.amount_paid)
  )
ON CONFLICT (sale_id) WHERE sale_id IS NOT NULL DO NOTHING;

REVOKE ALL ON FUNCTION public.sync_sale_payment_to_income() FROM PUBLIC;
