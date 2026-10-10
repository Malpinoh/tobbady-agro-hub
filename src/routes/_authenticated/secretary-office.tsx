import { useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Mail, Users, RefreshCw, Plus, CheckCircle2, type LucideIcon } from "lucide-react";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { friendlyError } from "@/lib/livestock";
import { PageHeader, Panel, RequirePermission, StatusBadge } from "@/components/app/PageKit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/secretary-office")({
  head: () => ({
    meta: [
      { title: "Secretary Office — TOBADDY AGRO LIVESTOCK" },
      { name: "description", content: "Manage meetings, correspondence and visitor records." },
    ],
  }),
  component: SecretaryOffice,
});

type SecretaryTab = "meetings" | "correspondence" | "visitors";
type Meeting = {
  id: string; title: string; meeting_date: string; meeting_time: string | null;
  venue: string | null; participants: string | null; agenda: string | null;
  minutes: string | null; status: "scheduled" | "completed" | "cancelled"; follow_up: string | null;
};
type Correspondence = {
  id: string; direction: "incoming" | "outgoing"; reference_number: string | null;
  subject: string; correspondent: string | null; correspondence_date: string;
  due_date: string | null; status: "open" | "pending" | "replied" | "closed"; notes: string | null;
};
type Visitor = {
  id: string; visitor_name: string; organization: string | null; purpose: string;
  person_to_visit: string | null; arrived_at: string; departed_at: string | null; notes: string | null;
};

function SecretaryOffice() {
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<SecretaryTab>("meetings");
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [meeting, setMeeting] = useState({
    title: "", meeting_date: new Date().toISOString().slice(0, 10), meeting_time: "",
    venue: "", participants: "", agenda: "",
  });
  const [letter, setLetter] = useState({
    direction: "incoming" as "incoming" | "outgoing", reference_number: "", subject: "",
    correspondent: "", correspondence_date: new Date().toISOString().slice(0, 10),
    due_date: "", status: "open" as "open" | "pending" | "replied" | "closed", notes: "",
  });
  const [visitor, setVisitor] = useState({
    visitor_name: "", organization: "", purpose: "", person_to_visit: "", notes: "",
  });

  const canManage = roles.some((role) => ["ceo", "secretary", "administrator"].includes(role));

  const meetingsQuery = useQuery({
    queryKey: ["secretary-office", "meetings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("secretary_meetings")
        .select("id,title,meeting_date,meeting_time,venue,participants,agenda,minutes,status,follow_up")
        .order("meeting_date", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as Meeting[];
    },
  });
  const correspondenceQuery = useQuery({
    queryKey: ["secretary-office", "correspondence"],
    queryFn: async () => {
      const { data, error } = await supabase.from("secretary_correspondence")
        .select("id,direction,reference_number,subject,correspondent,correspondence_date,due_date,status,notes")
        .order("correspondence_date", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as Correspondence[];
    },
  });
  const visitorsQuery = useQuery({
    queryKey: ["secretary-office", "visitors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("secretary_visitors")
        .select("id,visitor_name,organization,purpose,person_to_visit,arrived_at,departed_at,notes")
        .order("arrived_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as Visitor[];
    },
  });

  async function finishWrite(work: () => Promise<void>, success: string) {
    setSaving(true);
    setNotice("");
    setErrorMessage("");
    try {
      await work();
      setNotice(success);
    } catch (error) {
      setErrorMessage(friendlyError(error));
    } finally {
      setSaving(false);
    }
  }

  async function addMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !canManage) return;
    await finishWrite(async () => {
      const { error } = await supabase.from("secretary_meetings").insert({
        title: meeting.title.trim(), meeting_date: meeting.meeting_date,
        meeting_time: meeting.meeting_time || null, venue: meeting.venue.trim() || null,
        participants: meeting.participants.trim() || null, agenda: meeting.agenda.trim() || null,
        created_by: user.id,
      });
      if (error) throw error;
      setMeeting({ title: "", meeting_date: new Date().toISOString().slice(0, 10), meeting_time: "", venue: "", participants: "", agenda: "" });
      await queryClient.invalidateQueries({ queryKey: ["secretary-office", "meetings"] });
    }, "Meeting saved.");
  }

  async function addCorrespondence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !canManage) return;
    await finishWrite(async () => {
      const { error } = await supabase.from("secretary_correspondence").insert({
        direction: letter.direction, reference_number: letter.reference_number.trim() || null,
        subject: letter.subject.trim(), correspondent: letter.correspondent.trim() || null,
        correspondence_date: letter.correspondence_date, due_date: letter.due_date || null,
        status: letter.status, notes: letter.notes.trim() || null, created_by: user.id,
      });
      if (error) throw error;
      setLetter({ direction: "incoming", reference_number: "", subject: "", correspondent: "", correspondence_date: new Date().toISOString().slice(0, 10), due_date: "", status: "open", notes: "" });
      await queryClient.invalidateQueries({ queryKey: ["secretary-office", "correspondence"] });
    }, "Correspondence record saved.");
  }

  async function addVisitor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !canManage) return;
    await finishWrite(async () => {
      const { error } = await supabase.from("secretary_visitors").insert({
        visitor_name: visitor.visitor_name.trim(), organization: visitor.organization.trim() || null,
        purpose: visitor.purpose.trim(), person_to_visit: visitor.person_to_visit.trim() || null,
        notes: visitor.notes.trim() || null, recorded_by: user.id,
      });
      if (error) throw error;
      setVisitor({ visitor_name: "", organization: "", purpose: "", person_to_visit: "", notes: "" });
      await queryClient.invalidateQueries({ queryKey: ["secretary-office", "visitors"] });
    }, "Visitor entry saved.");
  }

  async function markMeeting(id: string, status: Meeting["status"]) {
    await finishWrite(async () => {
      const { error } = await supabase.from("secretary_meetings").update({ status }).eq("id", id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["secretary-office", "meetings"] });
    }, "Meeting status updated.");
  }
  async function markCorrespondence(id: string, status: Correspondence["status"]) {
    await finishWrite(async () => {
      const { error } = await supabase.from("secretary_correspondence").update({ status }).eq("id", id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["secretary-office", "correspondence"] });
    }, "Correspondence status updated.");
  }
  async function checkoutVisitor(id: string) {
    await finishWrite(async () => {
      const { error } = await supabase.from("secretary_visitors").update({ departed_at: new Date().toISOString() }).eq("id", id).is("departed_at", null);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["secretary-office", "visitors"] });
    }, "Visitor checked out.");
  }

  const loading = meetingsQuery.isLoading || correspondenceQuery.isLoading || visitorsQuery.isLoading;
  const queries = [meetingsQuery, correspondenceQuery, visitorsQuery];
  const queryError = queries.find((query) => query.isError)?.error;
  const meetings = meetingsQuery.data ?? [];
  const letters = correspondenceQuery.data ?? [];
  const visitors = visitorsQuery.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = meetings.filter((item) => item.meeting_date >= today && item.status === "scheduled").length;
  const openLetters = letters.filter((item) => item.status === "open" || item.status === "pending").length;
  const visitorsOnSite = visitors.filter((item) => !item.departed_at).length;

  return (
    <RequirePermission perm="secretary.view">
      <div className="space-y-6">
        <PageHeader
          title="Secretary Office"
          description="Manage farm meetings, official correspondence and visitor records."
          actions={<Button variant="outline" onClick={() => void Promise.all(queries.map((query) => query.refetch()))} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Summary icon={CalendarDays} label="Upcoming meetings" value={String(upcoming)} />
          <Summary icon={Mail} label="Open correspondence" value={String(openLetters)} />
          <Summary icon={Users} label="Visitors on site" value={String(visitorsOnSite)} />
        </div>

        {notice && <p role="status" className="rounded-lg border border-green-600/30 p-3 text-sm">{notice}</p>}
        {errorMessage && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{errorMessage}</p>}
        {queryError && (
          <div role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm">
            <p className="font-semibold">Secretary Office data could not be loaded.</p>
            <p className="mt-1">{friendlyError(queryError)}</p>
            <p className="mt-2 text-muted-foreground">If this is the first deployment, apply the Secretary Office SQL migration from the repository to the connected Supabase database, then refresh.</p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => void Promise.all(queries.map((query) => query.refetch()))}>Retry</Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-b pb-3">
          <Button variant={tab === "meetings" ? "default" : "outline"} onClick={() => setTab("meetings")}><CalendarDays className="mr-2 h-4 w-4" />Meetings & Schedules</Button>
          <Button variant={tab === "correspondence" ? "default" : "outline"} onClick={() => setTab("correspondence")}><Mail className="mr-2 h-4 w-4" />Correspondence</Button>
          <Button variant={tab === "visitors" ? "default" : "outline"} onClick={() => setTab("visitors")}><Users className="mr-2 h-4 w-4" />Visitor Log</Button>
        </div>

        {tab === "meetings" && <div className="space-y-5">
          {canManage && <Panel title="Schedule a meeting">
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={addMeeting}>
              <Field label="Meeting title *"><Input required maxLength={200} value={meeting.title} onChange={(e) => setMeeting({ ...meeting, title: e.target.value })} placeholder="e.g. Weekly farm management meeting" /></Field>
              <Field label="Date *"><Input required type="date" value={meeting.meeting_date} onChange={(e) => setMeeting({ ...meeting, meeting_date: e.target.value })} /></Field>
              <Field label="Time"><Input type="time" value={meeting.meeting_time} onChange={(e) => setMeeting({ ...meeting, meeting_time: e.target.value })} /></Field>
              <Field label="Venue"><Input maxLength={200} value={meeting.venue} onChange={(e) => setMeeting({ ...meeting, venue: e.target.value })} placeholder="Meeting room / location" /></Field>
              <Field label="Participants"><Input maxLength={1000} value={meeting.participants} onChange={(e) => setMeeting({ ...meeting, participants: e.target.value })} placeholder="Names separated by commas" /></Field>
              <Field label="Agenda"><Input maxLength={2000} value={meeting.agenda} onChange={(e) => setMeeting({ ...meeting, agenda: e.target.value })} placeholder="Main topics" /></Field>
              <div className="sm:col-span-2"><Button type="submit" disabled={saving}><Plus className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save meeting"}</Button></div>
            </form>
          </Panel>}
          <Panel title="Meeting schedule">
            {loading ? <Loading /> : meetings.length === 0 ? <Empty text="No meetings recorded yet. Schedule the first meeting above." /> :
              <div className="space-y-3">{meetings.map((item) => <article key={item.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{format(new Date(item.meeting_date + "T12:00:00"), "EEE, d MMM yyyy")}{item.meeting_time ? " · " + item.meeting_time.slice(0,5) : ""}{item.venue ? " · " + item.venue : ""}</p></div><StatusBadge tone={item.status === "completed" ? "success" : item.status === "cancelled" ? "danger" : "info"}>{item.status}</StatusBadge></div>
                {item.participants && <p className="mt-2 text-sm"><strong>Participants:</strong> {item.participants}</p>}
                {item.agenda && <p className="mt-1 text-sm"><strong>Agenda:</strong> {item.agenda}</p>}
                {canManage && item.status === "scheduled" && <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" disabled={saving} onClick={() => void markMeeting(item.id, "completed")}><CheckCircle2 className="mr-1 h-4 w-4" />Complete</Button><Button size="sm" variant="ghost" disabled={saving} onClick={() => void markMeeting(item.id, "cancelled")}>Cancel</Button></div>}
              </article>)}</div>}
          </Panel>
        </div>}

        {tab === "correspondence" && <div className="space-y-5">
          {canManage && <Panel title="Record correspondence">
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={addCorrespondence}>
              <Field label="Direction *"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={letter.direction} onChange={(e) => setLetter({ ...letter, direction: e.target.value as typeof letter.direction })}><option value="incoming">Incoming</option><option value="outgoing">Outgoing</option></select></Field>
              <Field label="Subject *"><Input required maxLength={250} value={letter.subject} onChange={(e) => setLetter({ ...letter, subject: e.target.value })} placeholder="Letter or email subject" /></Field>
              <Field label="Sender / recipient"><Input maxLength={200} value={letter.correspondent} onChange={(e) => setLetter({ ...letter, correspondent: e.target.value })} /></Field>
              <Field label="Reference number"><Input maxLength={100} value={letter.reference_number} onChange={(e) => setLetter({ ...letter, reference_number: e.target.value })} /></Field>
              <Field label="Date *"><Input required type="date" value={letter.correspondence_date} onChange={(e) => setLetter({ ...letter, correspondence_date: e.target.value })} /></Field>
              <Field label="Reply due date"><Input type="date" value={letter.due_date} onChange={(e) => setLetter({ ...letter, due_date: e.target.value })} /></Field>
              <Field label="Status"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={letter.status} onChange={(e) => setLetter({ ...letter, status: e.target.value as typeof letter.status })}><option value="open">Open</option><option value="pending">Pending</option><option value="replied">Replied</option><option value="closed">Closed</option></select></Field>
              <Field label="Notes"><Input maxLength={2000} value={letter.notes} onChange={(e) => setLetter({ ...letter, notes: e.target.value })} /></Field>
              <div className="sm:col-span-2"><Button type="submit" disabled={saving}><Plus className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save correspondence"}</Button></div>
            </form>
          </Panel>}
          <Panel title="Correspondence register">
            {loading ? <Loading /> : letters.length === 0 ? <Empty text="No correspondence recorded yet." /> :
              <div className="space-y-3">{letters.map((item) => <article key={item.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.subject}</h3><StatusBadge tone="neutral">{item.direction}</StatusBadge></div><p className="mt-1 text-sm text-muted-foreground">{item.correspondent || "No sender/recipient"} · {format(new Date(item.correspondence_date + "T12:00:00"), "d MMM yyyy")}{item.reference_number ? " · Ref: " + item.reference_number : ""}</p>{item.due_date && <p className="mt-1 text-xs text-muted-foreground">Reply due: {format(new Date(item.due_date + "T12:00:00"), "d MMM yyyy")}</p>}</div><StatusBadge tone={item.status === "closed" || item.status === "replied" ? "success" : "warning"}>{item.status}</StatusBadge></div>
                {item.notes && <p className="mt-2 text-sm">{item.notes}</p>}
                {canManage && item.status !== "closed" && <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={saving} onClick={() => void markCorrespondence(item.id, item.status === "replied" ? "closed" : "replied")}>{item.status === "replied" ? "Close record" : "Mark replied"}</Button><Button size="sm" variant="ghost" disabled={saving} onClick={() => void markCorrespondence(item.id, "pending")}>Mark pending</Button></div>}
              </article>)}</div>}
          </Panel>
        </div>}

        {tab === "visitors" && <div className="space-y-5">
          {canManage && <Panel title="Register a visitor">
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={addVisitor}>
              <Field label="Visitor name *"><Input required maxLength={200} value={visitor.visitor_name} onChange={(e) => setVisitor({ ...visitor, visitor_name: e.target.value })} /></Field>
              <Field label="Organization"><Input maxLength={200} value={visitor.organization} onChange={(e) => setVisitor({ ...visitor, organization: e.target.value })} /></Field>
              <Field label="Purpose of visit *"><Input required maxLength={500} value={visitor.purpose} onChange={(e) => setVisitor({ ...visitor, purpose: e.target.value })} /></Field>
              <Field label="Staff member to visit"><Input maxLength={200} value={visitor.person_to_visit} onChange={(e) => setVisitor({ ...visitor, person_to_visit: e.target.value })} /></Field>
              <div className="sm:col-span-2"><Field label="Notes"><Input maxLength={2000} value={visitor.notes} onChange={(e) => setVisitor({ ...visitor, notes: e.target.value })} /></Field></div>
              <div className="sm:col-span-2"><Button type="submit" disabled={saving}><Plus className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Register visitor"}</Button></div>
            </form>
          </Panel>}
          <Panel title="Visitor log">
            {loading ? <Loading /> : visitors.length === 0 ? <Empty text="No visitors recorded yet." /> :
              <div className="space-y-3">{visitors.map((item) => <article key={item.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{item.visitor_name}</h3><p className="mt-1 text-sm text-muted-foreground">{item.organization || "No organization"} · Arrived {format(new Date(item.arrived_at), "d MMM yyyy, HH:mm")}</p><p className="mt-1 text-sm"><strong>Purpose:</strong> {item.purpose}</p>{item.person_to_visit && <p className="mt-1 text-sm"><strong>Meeting with:</strong> {item.person_to_visit}</p>}</div><StatusBadge tone={item.departed_at ? "neutral" : "info"}>{item.departed_at ? "Checked out" : "On site"}</StatusBadge></div>
                {canManage && !item.departed_at && <Button className="mt-3" size="sm" variant="outline" disabled={saving} onClick={() => void checkoutVisitor(item.id)}>Check visitor out</Button>}
              </article>)}</div>}
          </Panel>
        </div>}

        <p className="text-xs text-muted-foreground">Records are stored in the farm's Supabase database. Access is restricted by the Secretary Office permission and database row-level security.</p>
      </div>
    </RequirePermission>
  );
}

function Summary({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <Panel><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted"><Icon className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div></div></Panel>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5 text-sm"><span className="font-medium">{label}</span>{children}</label>;
}
function Loading() { return <p className="py-6 text-center text-sm text-muted-foreground">Loading records...</p>; }
function Empty({ text }: { text: string }) { return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>; }
