import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, ClipboardCheck, Crown, FileText, ShieldCheck } from "lucide-react";
import { PageHeader, Panel } from "@/components/app/PageKit";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/operations-guide")({
  head: () => ({ meta: [{ title: "Operations Guide — TOBADDY AGRO LIVESTOCK" }, { name: "description", content: "Simple instructions for the CEO, Secretary and Administrator." }] }),
  component: OperationsGuidePage,
});

const modules = [
  { title: "Dashboard", purpose: "A quick look at animals, sales, money received, expenses and alerts. For details or corrections, open the page where the record was entered." },
  { title: "Farm Operations", purpose: "Keep the farm name and location up to date. Put animals in a named section when needed, or record that they are kept in the open compound." },
  { title: "Livestock", purpose: "Add individual animals or groups of animals. Keep their status and numbers correct when animals are sold, die or move." },
  { title: "Livestock Setup", purpose: "Manage animal groups, types and breeds. Do not remove a type or breed already used in farm records." },
  { title: "Inventory", purpose: "Track feed, medicine and other supplies. Record what comes in and what is used so stock numbers stay correct." },
  { title: "Suppliers & Procurement", purpose: "Record purchases from suppliers. Only add items to stock after they have actually arrived." },
  { title: "Sales & Customers", purpose: "Record customer sales and payments. If a customer pays only part of the bill, keep the unpaid balance separate." },
  { title: "Finance", purpose: "Check money received, expenses, payments and approvals. Record each sale in Sales only once." },
  { title: "Reports & Analytics", purpose: "Use the same dates when comparing reports. Total sales, money received, expenses and the cost of items sold are different figures." },
  { title: "Staff & Users / Settings", purpose: "Manage access only for authorised users. Assign the minimum permissions required for each person's job." },
];

function RolePanel({ title, icon: Icon, purpose, responsibilities, routine }: { title: string; icon: typeof Crown; purpose: string; responsibilities: string[]; routine: string[] }) {
  return <Panel title={title}>
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      <p className="text-sm leading-6 text-muted-foreground">{purpose}</p>
    </div>
    <div className="mt-4 grid gap-5 md:grid-cols-2">
      <div><h3 className="mb-2 text-sm font-semibold">What you are responsible for</h3><ul className="space-y-2">{responsibilities.map((item) => <li key={item} className="flex gap-2 text-sm"><span className="text-primary">•</span><span>{item}</span></li>)}</ul></div>
      <div><h3 className="mb-2 text-sm font-semibold">Regular checks</h3><ul className="space-y-2">{routine.map((item) => <li key={item} className="flex gap-2 text-sm"><ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{item}</span></li>)}</ul></div>
    </div>
  </Panel>;
}

function OperationsGuidePage() {
  const { hasRole } = useAuth();
  return <div className="space-y-6">
    <PageHeader title="Operations Guide" description="How to use TOBADDY AGRO LIVESTOCK, with responsibilities for the CEO, Secretary and Administrator." actions={<Button asChild variant="outline"><Link to="/dashboard">Back to Dashboard</Link></Button>} />
    <Panel title="How the platform works">
      <p className="text-sm leading-6 text-muted-foreground">Use the correct page for each task. Make sure a record has saved before trying again. After adding a sale, payment or expense, check that page and then compare the Dashboard and Reports for the same dates. If the numbers do not match, check the original record first. Do not add it again just to make the totals look right.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{modules.map((module) => <div key={module.title} className="rounded-lg border p-4"><h3 className="font-semibold">{module.title}</h3><p className="mt-1 text-sm leading-5 text-muted-foreground">{module.purpose}</p></div>)}</div>
    </Panel>
    <RolePanel title="CEO — Oversight and decisions" icon={Crown} purpose="The CEO checks how the farm is doing, makes decisions and approvals within their role, and makes sure farm and money records are correct." responsibilities={["Review Dashboard and CEO Office summaries and investigate unusual movements.", "Review sales, actual cash received, unpaid bills, expenses and profit as separate measures.", "Review approvals and management reports; ask for proof or supporting records before decisions.", "Protect official farm setup and past records; request corrections rather than deleting change history."]} routine={["Review daily activity, pending approvals and critical alerts.", "Compare sales, finance and reports for the same period.", "Review livestock and inventory exceptions and assign follow-up owners.", "Review month-end reports and document decisions or unresolved differences."]} />
    <RolePanel title="Secretary — Records and coordination" icon={FileText} purpose="The Secretary keeps documents and meeting notes organised, follows up on decisions and approvals, and does not change farm or money records without proof." responsibilities={["Maintain board and management documents and keep meeting/action records clear.", "Track pending approvals, requests, decisions and assigned follow-ups.", "Prepare summaries from approved source records and use consistent reporting dates.", "Escalate missing evidence, duplicate entries or mismatched figures to the responsible officer."]} routine={["Check pending actions and approval queues.", "File relevant supporting documents and meeting notes.", "Follow up owners and due dates for management decisions.", "Confirm completed actions have evidence and a clear record of changes."]} />
    <RolePanel title="Administrator — System and access control" icon={ShieldCheck} purpose="The Administrator manages staff access and system settings, helps fix access problems and protects farm records. Admin access must not be used to skip money checks." responsibilities={["Manage staff accounts, roles and permissions according to approved responsibilities.", "Maintain livestock types, breeds and configuration without orphaning existing records.", "Check system errors, data consistency and audit logs; escalate database or update problems.", "Never use test/reset actions on production data unless a safe, approved and verified procedure exists."]} routine={["Review new users and role assignments.", "Check failed operations and warnings about incorrect records.", "Verify backups/migrations and whether the latest update is working where available.", "Test fixes with controlled test records and confirm real farm records remain intact."]} />
    <Panel title="Daily checks">
      <ul className="grid gap-2 sm:grid-cols-2">{["Sales invoice total agrees with Sales Analytics.", "Amount paid agrees with money received; unpaid balance is separate.", "Sales income is not entered a second time manually.", "Sold/dead/transferred animals are excluded from active stock.", "Goods received and stock issues change inventory once only.", "Expense totals follow approval and payment statuses.", "CEO Office and Dashboard figures reconcile for the same date range.", "Differences are investigated and documented—never hidden with duplicate entries."].map((item) => <li key={item} className="flex gap-2 text-sm"><ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{item}</span></li>)}</ul>
    </Panel>
    <p className="text-xs text-muted-foreground">Access to modules is still controlled by assigned permissions. This guide explains responsibilities; it does not grant additional permissions. {hasRole("ceo") || hasRole("administrator") ? "You have an executive/administrator role; use the access controls only for approved business needs." : "If you cannot access a module mentioned here, ask the Administrator to review your assigned permissions."}</p>
  </div>;
}
