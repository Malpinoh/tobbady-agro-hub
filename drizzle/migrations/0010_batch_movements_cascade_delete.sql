-- Batch movements belong to a batch and must not outlive it.
-- Approved batch deletion should remove its dependent movement rows automatically.
ALTER TABLE public.batch_movements
  DROP CONSTRAINT IF EXISTS batch_movements_batch_id_fkey;

ALTER TABLE public.batch_movements
  ADD CONSTRAINT batch_movements_batch_id_fkey
  FOREIGN KEY (batch_id)
  REFERENCES public.animal_batches(id)
  ON DELETE CASCADE;
