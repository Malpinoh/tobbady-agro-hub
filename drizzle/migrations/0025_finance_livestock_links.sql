-- Make finance entries' livestock links real database relationships.
-- This fixes the UI sending animal_id/batch_id fields that the ledger tables did not store.
-- Existing finance history is preserved; new links are optional.

ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS animal_id uuid REFERENCES public.animals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.animal_batches(id) ON DELETE SET NULL;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS animal_id uuid REFERENCES public.animals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.animal_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS income_animal_id_idx ON public.income (animal_id);
CREATE INDEX IF NOT EXISTS income_batch_id_idx ON public.income (batch_id);
CREATE INDEX IF NOT EXISTS expenses_animal_id_idx ON public.expenses (animal_id);
CREATE INDEX IF NOT EXISTS expenses_batch_id_idx ON public.expenses (batch_id);
