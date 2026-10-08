```sql
-- Recalculate batch current_quantity whenever a movement is recorded.
-- Business rule:
-- current_quantity = initial_quantity - mortality - sale - transfer - adjustment

CREATE OR REPLACE FUNCTION public.recalculate_batch_quantity(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  initial_qty integer;
  removed_qty integer;
  new_qty integer;
BEGIN
  SELECT initial_quantity
  INTO initial_qty
  FROM public.animal_batches
  WHERE id = p_batch_id;

  IF initial_qty IS NULL THEN
    RAISE EXCEPTION 'Batch % does not exist', p_batch_id;
  END IF;

  SELECT COALESCE(SUM(quantity), 0)
  INTO removed_qty
  FROM public.batch_movements
  WHERE batch_id = p_batch_id;

  new_qty := initial_qty - removed_qty;

  IF new_qty < 0 THEN
    RAISE EXCEPTION
      'Batch quantity cannot go below zero. Initial quantity: %, removed: %',
      initial_qty,
      removed_qty;
  END IF;

  UPDATE public.animal_batches
  SET
    current_quantity = new_qty,
    status = CASE
      WHEN new_qty = 0 THEN 'closed'
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_batch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.batch_movement_recalculate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_batch_quantity(NEW.batch_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS batch_movements_recalculate
ON public.batch_movements;

CREATE TRIGGER batch_movements_recalculate
AFTER INSERT OR UPDATE ON public.batch_movements
FOR EACH ROW
EXECUTE FUNCTION public.batch_movement_recalculate();


-- Also handle deletion of a movement.
CREATE OR REPLACE FUNCTION public.batch_movement_delete_recalculate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_batch_quantity(OLD.batch_id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS batch_movements_delete_recalculate
ON public.batch_movements;

CREATE TRIGGER batch_movements_delete_recalculate
AFTER DELETE ON public.batch_movements
FOR EACH ROW
EXECUTE FUNCTION public.batch_movement_delete_recalculate();
```
