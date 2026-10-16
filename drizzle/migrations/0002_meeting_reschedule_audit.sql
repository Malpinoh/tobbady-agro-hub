DROP TRIGGER IF EXISTS secretary_meetings_reschedule_audit ON public.secretary_meetings;
CREATE TRIGGER secretary_meetings_reschedule_audit
AFTER UPDATE ON public.secretary_meetings
FOR EACH ROW
WHEN (OLD.meeting_date IS DISTINCT FROM NEW.meeting_date OR OLD.meeting_time IS DISTINCT FROM NEW.meeting_time)
EXECUTE FUNCTION public.log_row_change();