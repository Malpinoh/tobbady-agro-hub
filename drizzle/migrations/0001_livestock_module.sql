-- Batch movements: mortality / sale / transfer / adjustment reduce a batch's quantity
CREATE TABLE public.batch_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.animal_batches(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN ('mortality','sale','transfer','adjustment')),
  quantity integer NOT NULL CHECK (quantity > 0),
  occurred_on date NOT NULL DEFAULT current_date,
  to_section_id uuid REFERENCES public.farm_sections(id),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX batch_movements_batch_idx ON public.batch_movements(batch_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_movements TO authenticated;
GRANT ALL ON public.batch_movements TO service_role;
ALTER TABLE public.batch_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_read ON public.batch_movements FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY perm_insert ON public.batch_movements FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(),'livestock.manage') AND created_by = auth.uid());

-- current_quantity is always derived: initial - sum(movements)
CREATE OR REPLACE FUNCTION public.compute_batch_quantity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE used integer;
BEGIN
  SELECT COALESCE(SUM(quantity),0) INTO used FROM public.batch_movements WHERE batch_id = NEW.id;
  NEW.current_quantity := NEW.initial_quantity - used;
  IF NEW.current_quantity < 0 THEN
    RAISE EXCEPTION 'Batch quantity cannot go below zero (initial %, removed %)', NEW.initial_quantity, used;
  END IF;
  IF NEW.current_quantity = 0 AND NEW.status = 'active' THEN NEW.status := 'closed'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER animal_batches_compute_qty BEFORE INSERT OR UPDATE ON public.animal_batches
  FOR EACH ROW EXECUTE FUNCTION public.compute_batch_quantity();

CREATE OR REPLACE FUNCTION public.touch_batch_after_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.animal_batches SET updated_at = now() WHERE id = NEW.batch_id;
  RETURN NEW;
END $$;
CREATE TRIGGER batch_movements_touch AFTER INSERT ON public.batch_movements
  FOR EACH ROW EXECUTE FUNCTION public.touch_batch_after_movement();

-- Wire the existing audit + updated_at helpers onto livestock tables
CREATE TRIGGER animals_audit AFTER INSERT OR UPDATE OR DELETE ON public.animals FOR EACH ROW EXECUTE FUNCTION public.log_row_change();
CREATE TRIGGER animal_batches_audit AFTER INSERT OR UPDATE OR DELETE ON public.animal_batches FOR EACH ROW EXECUTE FUNCTION public.log_row_change();
CREATE TRIGGER batch_movements_audit AFTER INSERT ON public.batch_movements FOR EACH ROW EXECUTE FUNCTION public.log_row_change();
CREATE TRIGGER breeds_audit AFTER INSERT OR UPDATE OR DELETE ON public.breeds FOR EACH ROW EXECUTE FUNCTION public.log_row_change();
CREATE TRIGGER livestock_types_audit AFTER INSERT OR UPDATE OR DELETE ON public.livestock_types FOR EACH ROW EXECUTE FUNCTION public.log_row_change();
CREATE TRIGGER animals_touch BEFORE UPDATE ON public.animals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER livestock_types_touch BEFORE UPDATE ON public.livestock_types FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Livestock viewers may read the audit entries for livestock records
CREATE POLICY livestock_audit_read ON public.activity_logs FOR SELECT TO authenticated
  USING (table_name IN ('animals','animal_batches','batch_movements') AND public.has_permission(auth.uid(),'livestock.view'));