-- Block unassigned accounts from creating even pending livestock-change requests.
-- Staff with an assigned role may submit a request; CEO/Administrator review remains unchanged.
DROP POLICY IF EXISTS "Users submit livestock change requests" ON public.record_change_requests;
CREATE POLICY "Assigned staff submit livestock change requests"
ON public.record_change_requests
FOR INSERT TO authenticated
WITH CHECK (
  public.is_staff(auth.uid())
  AND requested_by = auth.uid()
  AND status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
);
