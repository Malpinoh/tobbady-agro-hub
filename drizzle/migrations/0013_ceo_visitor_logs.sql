-- Allow CEO and Administrator users to view the shared visitor register in CEO Office.
-- Secretaries retain access through the existing secretary.view permission.
drop policy if exists "Secretary office readers can view visitors" on public.secretary_visitors;

create policy "Secretary office readers can view visitors"
on public.secretary_visitors
for select
to authenticated
using (
  public.has_permission(auth.uid(), 'secretary.view')
  or public.has_role(auth.uid(), 'ceo'::public.app_role)
  or public.has_role(auth.uid(), 'administrator'::public.app_role)
);
