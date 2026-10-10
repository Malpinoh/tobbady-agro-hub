-- When a batch is deleted with ON DELETE CASCADE, its movement rows are
-- deleted too. Do not recalculate quantity for a parent batch that no longer exists.
CREATE OR REPLACE FUNCTION public.batch_movement_delete_recalculate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.animal_batches
    WHERE id = OLD.batch_id
  ) THEN
    PERFORM public.recalculate_batch_quantity(OLD.batch_id);
  END IF;

  RETURN OLD;
END;
$$;
