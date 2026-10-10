-- CEO/Administrator approval workflow for livestock edits and deletions.
CREATE TABLE IF NOT EXISTS public.record_change_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 record_type text NOT NULL CHECK (record_type IN ('animal','batch')),
 record_id uuid NOT NULL,
 request_type text NOT NULL CHECK (request_type IN ('edit','delete')),
 record_label text NOT NULL,
 reason text NOT NULL CHECK (length(trim(reason)) >= 5),
 proposed_values jsonb,
 original_values jsonb NOT NULL DEFAULT '{}'::jsonb,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
 requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
 requested_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 reviewed_at timestamptz,
 rejection_reason text,
 CHECK ((request_type='delete' AND proposed_values IS NULL) OR (request_type='edit' AND proposed_values IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS record_change_requests_pending_idx ON public.record_change_requests(status, requested_at DESC);
ALTER TABLE public.record_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CEO admin review change requests" ON public.record_change_requests;
CREATE POLICY "CEO admin review change requests" ON public.record_change_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'ceo'::public.app_role) OR public.has_role(auth.uid(),'administrator'::public.app_role));
DROP POLICY IF EXISTS "Users submit livestock change requests" ON public.record_change_requests;
CREATE POLICY "Users submit livestock change requests" ON public.record_change_requests FOR INSERT TO authenticated WITH CHECK (requested_by=auth.uid() AND status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL);
DROP POLICY IF EXISTS "CEO admin update change requests" ON public.record_change_requests;
CREATE POLICY "CEO admin update change requests" ON public.record_change_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'ceo'::public.app_role) OR public.has_role(auth.uid(),'administrator'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'ceo'::public.app_role) OR public.has_role(auth.uid(),'administrator'::public.app_role));

CREATE OR REPLACE FUNCTION public.review_record_change_request(p_request_id uuid, p_decision text, p_rejection_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.record_change_requests%ROWTYPE; v jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'ceo'::public.app_role) OR public.has_role(auth.uid(),'administrator'::public.app_role)) THEN
   RAISE EXCEPTION 'Only the CEO or Administrator can review change requests';
 END IF;
 IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Decision must be approved or rejected'; END IF;
 SELECT * INTO r FROM public.record_change_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Change request not found'; END IF;
 IF r.status <> 'pending' THEN RAISE EXCEPTION 'This request has already been reviewed'; END IF;
 IF p_decision='approved' THEN
   IF r.record_type='animal' THEN
     IF r.request_type='delete' THEN DELETE FROM public.animals WHERE id=r.record_id;
     ELSE
       v := r.proposed_values;
       UPDATE public.animals SET
         tag_number=COALESCE(v->>'tag_number',tag_number),
         livestock_type_id=COALESCE(NULLIF(v->>'livestock_type_id','')::uuid,livestock_type_id),
         breed_id=CASE WHEN v ? 'breed_id' THEN NULLIF(v->>'breed_id','')::uuid ELSE breed_id END,
         sex=CASE WHEN v ? 'sex' THEN NULLIF(v->>'sex','') ELSE sex END,
         date_of_birth=CASE WHEN v ? 'date_of_birth' THEN NULLIF(v->>'date_of_birth','')::date ELSE date_of_birth END,
         acquired_on=CASE WHEN v ? 'acquired_on' THEN NULLIF(v->>'acquired_on','')::date ELSE acquired_on END,
         acquisition_cost=CASE WHEN v ? 'acquisition_cost' THEN NULLIF(v->>'acquisition_cost','')::numeric ELSE acquisition_cost END,
         estimated_value=CASE WHEN v ? 'estimated_value' THEN NULLIF(v->>'estimated_value','')::numeric ELSE estimated_value END,
         farm_id=CASE WHEN v ? 'farm_id' THEN NULLIF(v->>'farm_id','')::uuid ELSE farm_id END,
         farm_section_id=CASE WHEN v ? 'farm_section_id' THEN NULLIF(v->>'farm_section_id','')::uuid ELSE farm_section_id END,
         location_description=CASE WHEN v ? 'location_description' THEN NULLIF(v->>'location_description','') ELSE location_description END,
         status=COALESCE(v->>'status',status),
         notes=CASE WHEN v ? 'notes' THEN NULLIF(v->>'notes','') ELSE notes END
       WHERE id=r.record_id;
     END IF;
   ELSIF r.record_type='batch' THEN
     IF r.request_type='delete' THEN DELETE FROM public.animal_batches WHERE id=r.record_id;
     ELSE
       v := r.proposed_values;
       UPDATE public.animal_batches SET
         batch_code=COALESCE(v->>'batch_code',batch_code),
         livestock_type_id=COALESCE(NULLIF(v->>'livestock_type_id','')::uuid,livestock_type_id),
         breed_id=CASE WHEN v ? 'breed_id' THEN NULLIF(v->>'breed_id','')::uuid ELSE breed_id END,
         initial_quantity=COALESCE(NULLIF(v->>'initial_quantity','')::integer,initial_quantity),
         started_on=CASE WHEN v ? 'started_on' THEN NULLIF(v->>'started_on','')::date ELSE started_on END,
         acquisition_cost=CASE WHEN v ? 'acquisition_cost' THEN NULLIF(v->>'acquisition_cost','')::numeric ELSE acquisition_cost END,
         estimated_unit_value=CASE WHEN v ? 'estimated_unit_value' THEN NULLIF(v->>'estimated_unit_value','')::numeric ELSE estimated_unit_value END,
         farm_id=CASE WHEN v ? 'farm_id' THEN NULLIF(v->>'farm_id','')::uuid ELSE farm_id END,
         farm_section_id=CASE WHEN v ? 'farm_section_id' THEN NULLIF(v->>'farm_section_id','')::uuid ELSE farm_section_id END,
         location_description=CASE WHEN v ? 'location_description' THEN NULLIF(v->>'location_description','') ELSE location_description END,
         status=COALESCE(v->>'status',status),
         notes=CASE WHEN v ? 'notes' THEN NULLIF(v->>'notes','') ELSE notes END
       WHERE id=r.record_id;
     END IF;
   END IF;
 END IF;
 UPDATE public.record_change_requests SET status=p_decision, reviewed_by=auth.uid(), reviewed_at=now(),
   rejection_reason=CASE WHEN p_decision='rejected' THEN NULLIF(trim(p_rejection_reason),'') ELSE NULL END WHERE id=r.id;
END; $$;
REVOKE ALL ON FUNCTION public.review_record_change_request(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_record_change_request(uuid,text,text) TO authenticated;
