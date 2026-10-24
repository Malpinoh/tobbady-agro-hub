ALTER TABLE public.record_change_requests ADD COLUMN mortality_quantity integer;
ALTER TABLE public.record_change_requests ADD COLUMN death_on date;
CREATE UNIQUE INDEX mortality_one_pending_record ON public.record_change_requests(record_type, record_id) WHERE status = 'pending' AND mortality_quantity IS NOT NULL;
CREATE POLICY "Submitters read own change requests" ON public.record_change_requests FOR SELECT TO authenticated USING (requested_by = auth.uid());
CREATE OR REPLACE FUNCTION public.guard_mortality_change_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.animals%ROWTYPE; b public.animal_batches%ROWTYPE;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.mortality_quantity IS NULL THEN
   IF public.has_role(auth.uid(),'secretary') AND NEW.proposed_values->>'status' = 'dead' THEN RAISE EXCEPTION 'Submit a mortality request for CEO approval instead'; END IF;
   RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'secretary') OR NOT public.has_permission(auth.uid(),'livestock.manage') THEN RAISE EXCEPTION 'Only an authorized Secretary can submit mortality requests'; END IF;
  IF NEW.request_type <> 'edit' OR NEW.proposed_values IS DISTINCT FROM '{}'::jsonb OR NEW.status <> 'pending' OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL THEN RAISE EXCEPTION 'Invalid mortality submission'; END IF;
  IF NEW.mortality_quantity <= 0 OR NEW.death_on IS NULL OR NEW.death_on > CURRENT_DATE OR length(trim(NEW.reason)) < 5 THEN RAISE EXCEPTION 'Provide a positive quantity, valid death date and reason (at least 5 characters)'; END IF;
  NEW.requested_by := auth.uid(); NEW.requested_at := now();
  IF NEW.record_type='animal' THEN
   SELECT * INTO a FROM public.animals WHERE id=NEW.record_id FOR UPDATE;
   IF NOT FOUND OR a.approval_status <> 'approved' OR a.status NOT IN ('active','quarantined','missing') OR NEW.mortality_quantity <> 1 THEN RAISE EXCEPTION 'Choose an approved living individual animal; quantity must be one'; END IF;
   NEW.original_values := to_jsonb(a); NEW.record_label := a.tag_number;
  ELSE
   SELECT * INTO b FROM public.animal_batches WHERE id=NEW.record_id FOR UPDATE;
   IF NOT FOUND OR b.approval_status <> 'approved' OR b.status <> 'active' OR NEW.mortality_quantity > b.current_quantity THEN RAISE EXCEPTION 'Choose an approved active batch with enough remaining stock'; END IF;
   NEW.original_values := to_jsonb(b); NEW.record_label := b.batch_code;
  END IF;
  RETURN NEW;
 END IF;
 IF OLD.mortality_quantity IS NULL AND NEW.mortality_quantity IS NULL THEN RETURN NEW; END IF;
 IF OLD.mortality_quantity IS NULL OR (to_jsonb(NEW) - ARRAY['status','reviewed_by','reviewed_at','rejection_reason']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','reviewed_by','reviewed_at','rejection_reason']) THEN RAISE EXCEPTION 'Submitted mortality details cannot be changed'; END IF;
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'ceo') OR auth.uid()=OLD.requested_by THEN RAISE EXCEPTION 'Only a different CEO can review this mortality request'; END IF;
 IF OLD.status <> 'pending' OR NEW.status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Mortality request has already been reviewed'; END IF;
 NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
 IF NEW.status='rejected' THEN
  IF COALESCE(length(trim(NEW.rejection_reason)),0)=0 THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;
  RETURN NEW;
 END IF;
 NEW.rejection_reason := NULL;
 IF OLD.record_type='animal' THEN
  SELECT * INTO a FROM public.animals WHERE id=OLD.record_id FOR UPDATE;
  IF NOT FOUND OR a.approval_status <> 'approved' OR a.status NOT IN ('active','quarantined','missing') THEN RAISE EXCEPTION 'Animal is no longer eligible for mortality approval'; END IF;
  UPDATE public.animals SET status='dead', notes=concat_ws(E'\n', NULLIF(notes,''), '[' || OLD.death_on || '] Death approved: ' || OLD.reason) WHERE id=a.id;
 ELSE
  SELECT * INTO b FROM public.animal_batches WHERE id=OLD.record_id FOR UPDATE;
  IF NOT FOUND OR b.approval_status <> 'approved' OR b.status <> 'active' OR b.current_quantity < OLD.mortality_quantity THEN RAISE EXCEPTION 'Batch no longer has sufficient approved stock'; END IF;
  INSERT INTO public.batch_movements(batch_id,movement_type,quantity,occurred_on,notes,created_by) VALUES(b.id,'mortality',OLD.mortality_quantity,OLD.death_on,OLD.reason || ' (CEO approved request ' || OLD.id || ')',auth.uid());
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mortality_request_guard BEFORE INSERT OR UPDATE ON public.record_change_requests FOR EACH ROW EXECUTE FUNCTION public.guard_mortality_change_request();
CREATE OR REPLACE FUNCTION public.submit_mortality_request(p_record_type text,p_record_id uuid,p_quantity integer,p_death_on date,p_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'secretary') OR NOT public.has_permission(auth.uid(),'livestock.manage') THEN RAISE EXCEPTION 'Only an authorized Secretary can submit mortality requests'; END IF;
 INSERT INTO public.record_change_requests(record_type,record_id,request_type,record_label,reason,proposed_values,mortality_quantity,death_on) VALUES(p_record_type,p_record_id,'edit','Mortality',trim(p_reason),'{}'::jsonb,p_quantity,p_death_on) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.submit_mortality_request(text,uuid,integer,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_mortality_request(text,uuid,integer,date,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_secretary_direct_mortality() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF public.has_role(auth.uid(),'secretary') AND NOT public.has_role(auth.uid(),'ceo') THEN
  IF TG_TABLE_NAME='batch_movements' THEN
   IF NEW.movement_type='mortality' THEN RAISE EXCEPTION 'Secretary mortality must be submitted for CEO approval'; END IF;
  ELSIF NEW.status='dead' THEN
   IF TG_OP='INSERT' THEN RAISE EXCEPTION 'Secretary mortality must be submitted for CEO approval'; END IF;
   IF OLD.status IS DISTINCT FROM NEW.status THEN RAISE EXCEPTION 'Secretary mortality must be submitted for CEO approval'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER secretary_mortality_guard BEFORE INSERT OR UPDATE ON public.animals FOR EACH ROW EXECUTE FUNCTION public.guard_secretary_direct_mortality();
CREATE TRIGGER secretary_mortality_guard BEFORE INSERT OR UPDATE ON public.animal_batches FOR EACH ROW EXECUTE FUNCTION public.guard_secretary_direct_mortality();
CREATE TRIGGER secretary_mortality_guard BEFORE INSERT OR UPDATE ON public.batch_movements FOR EACH ROW EXECUTE FUNCTION public.guard_secretary_direct_mortality();
CREATE TRIGGER audit_mortality_requests AFTER INSERT OR UPDATE ON public.record_change_requests FOR EACH ROW WHEN (NEW.mortality_quantity IS NOT NULL) EXECUTE FUNCTION public.log_row_change();
CREATE OR REPLACE FUNCTION public.correct_expense(p_expense_id uuid,p_expected_updated_at timestamptz,p_values jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.expenses%ROWTYPE; elevated boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(),'finance.manage') THEN RAISE EXCEPTION 'Finance management permission is required'; END IF;
 SELECT * INTO e FROM public.expenses WHERE id=p_expense_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Expense not found'; END IF;
 IF e.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Expense changed since it was opened. Reload and try again'; END IF;
 elevated := public.has_role(auth.uid(),'ceo') OR public.has_role(auth.uid(),'administrator');
 IF e.status <> 'pending' OR e.payment_status='paid' THEN
  IF NOT elevated THEN RAISE EXCEPTION 'Only CEO or Administrator can correct reviewed or paid expenses'; END IF;
  IF (p_values - ARRAY['spent_on','description','reference']) <> '{}'::jsonb THEN RAISE EXCEPTION 'Reviewed or paid expenses permit date, description and reference corrections only'; END IF;
 END IF;
 IF p_values ? 'spent_on' AND NULLIF(p_values->>'spent_on','') IS NULL THEN RAISE EXCEPTION 'Expense date is required'; END IF;
 IF p_values ? 'amount' AND (NULLIF(p_values->>'amount','')::numeric IS NULL OR (p_values->>'amount')::numeric <= 0) THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
 IF p_values ? 'category' AND COALESCE(length(trim(p_values->>'category')),0)=0 THEN RAISE EXCEPTION 'Category is required'; END IF;
 UPDATE public.expenses SET spent_on=COALESCE((p_values->>'spent_on')::date,spent_on),
 description=CASE WHEN p_values ? 'description' THEN NULLIF(trim(p_values->>'description'),'') ELSE description END,
 reference=CASE WHEN p_values ? 'reference' THEN NULLIF(trim(p_values->>'reference'),'') ELSE reference END,
 amount=COALESCE((p_values->>'amount')::numeric,amount), category=COALESCE(p_values->>'category',category),
 animal_id=CASE WHEN p_values ? 'animal_id' THEN NULLIF(p_values->>'animal_id','')::uuid ELSE animal_id END,
 batch_id=CASE WHEN p_values ? 'batch_id' THEN NULLIF(p_values->>'batch_id','')::uuid ELSE batch_id END WHERE id=e.id;
END $$;
REVOKE ALL ON FUNCTION public.correct_expense(uuid,timestamptz,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.correct_expense(uuid,timestamptz,jsonb) TO authenticated;