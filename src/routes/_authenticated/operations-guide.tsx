import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Building2, ClipboardCheck, Crown, FileText, ShieldCheck, Users } from "lucide-react";
import { PageHeader, Panel } from "@/components/app/PageKit";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/operations-guide")({
  head: () => ({ meta: [{ title: "Operations Guide — TOBADDY AGRO LIVESTOCK" }, { name: "description", content: "Role-specific operating procedures for CEO, Secretary and Administrator." }] }),
  component: OperationsGuidePage,
});

const modules = [
  { title: "Dashboard", purpose: "Daily overview of livestock, sales, expenses, revenue and alerts. Treat it as a summary; open the source module to inspect or correct a record." },
  { title: "Farm Operations", purpose: "Maintain the farm profile and location information. Assign animals to a section when relevant; an open compound location is also valid." },
  { title: "Livestock", purpose: "Register individual animals or batches, keep status and quantity current, and verify sales, mortality or transfers update active stock." },
  { title: "Livestock Setup", purpose: "Maintain livestock categories, types and breeds. Do not remove types or breeds that existing animals depend on." },
  { title: "Inventory", purpose: "Track feed, medicines and supplies. Use receiving and issuing transactions rather than manually changing counts without an audit trail." },
  { title: "Suppliers & Procurement", purpose: "Record supplier purchases, then confirm actual goods received. A purchase order alone must not be treated as stock received." },
  { title: "Sales & Customers", purpose: "Create sales invoices and record the amount actually paid. The full invoice total and amount received are different when payment is partial." },
  { title: "Finance", purpose: "Review income and expenses, approval status and payments. Record sales through Sales so a second manual income entry is not created." },
  { title: "Reports & Analytics", purpose: "Choose the same date range when comparing totals. Sales, payments received, expenses and cost of goods sold are separate measures." },
  { title: "Staff & Users / Settings", purpose: "Manage access only for authorised users. Assign the minimum permissions required for each person's job." },
];

function RolePanel({ title, icon: Icon, purpose, responsibilities, routine }: { title: string; icon: typeof Crown; purpose: string; responsibilities: string[]; routine: string[] }) {
  return <Panel title={title}>
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      <p className="text-sm leading-6 text-muted-foreground">{purpose}</p>
    </div>
    <div className="mt-4 grid gap-5 md:grid-cols-2">
      <div><h3 className="mb-2 text-sm font-semibold">Main responsibilities</h3><ul className="space-y-2">{responsibilities.map((item) => <li key={item} className="flex gap-2 text-sm"><span className="text-primary">•</span><span>{item}</span></li>)}</ul></div>
      <div><h3 className="mb-2 text-sm font-semibold">Routine checklist</h3><ul className="space-y-2">{routine.map((item) => <li key={item} className="flex gap-2 text-sm"><ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{item}</span></li>)}</ul></div>
    </div>
  </Panel>;
}

function OperationsGuidePage() {
  const { hasRole } = useAuth();
  return <div className="space-y-6">
    <PageHeader title="Operations Guide" description="How to use TOBADDY AGRO LIVESTOCK, with responsibilities for the CEO, Secretary and Administrator." actions={<Button asChild variant="outline"><Link to="/dashboard">Back to Dashboard</Link></Button>} />
    <Panel title="How the platform works">
      <p className="text-sm leading-6 text-muted-foreground">Use each module for the transaction it owns. Confirm a transaction has saved before repeating it. After recording a sale, receipt or expense, check the relevant source page and then compare the Dashboard and Reports using the same dates and status definitions. If figures differ, do not create a duplicate entry to force them to match—inspect the source transaction and its status first.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{modules.map((module) => <div key={module.title} className="rounded-lg border p-4"><h3 className="font-semibold">{module.title}</h3><p className="mt-1 text-sm leading-5 text-muted-foreground">{module.purpose}</p></div>)}</div>
    </Panel>
    <RolePanel title="CEO — Oversight and decisions" icon={Crown} purpose="The CEO reviews the overall position of the farm, approves decisions within their authority, and ensures operational and financial records are reliable." responsibilities={["Review Dashboard and CEO Office summaries and investigate unusual movements.", "Review sales, actual cash received, outstanding balances, expenses and profit as separate measures.", "Review approvals and management reports; ask for supporting records before decisions.", "Protect official farm setup and historical records; request corrections rather than deleting audit history."]} routine={["Review daily activity, pending approvals and critical alerts.", "Compare sales, finance and reports for the same period.", "Review livestock and inventory exceptions and assign follow-up owners.", "Review month-end reports and document decisions or unresolved differences."]} />
    <RolePanel title="Secretary — Records and coordination" icon={FileText} purpose="The Secretary keeps management information organised, follows up actions and supports meeting, approval and document workflows without changing operational figures without evidence." responsibilities={["Maintain board and management documents and keep meeting/action records clear.", "Track pending approvals, requests, decisions and assigned follow-ups.", "Prepare summaries from approved source records and use consistent reporting dates.", "Escalate missing evidence, duplicate entries or mismatched figures to the responsible officer."]} routine={["Check pending actions and approval queues.", "File relevant supporting documents and meeting notes.", "Follow up owners and due dates for management decisions.", "Confirm completed actions have evidence and a clear audit trail."]} />
    <RolePanel title="Administrator — System and access control" icon={ShieldCheck} purpose="The Administrator maintains user access and system configuration, helps users resolve access issues and safeguards data. Administrative access is not a reason to bypass financial controls." responsibilities={["Manage staff accounts, roles and permissions according to approved responsibilities.", "Maintain livestock types, breeds and configuration without orphaning existing records.", "Check system errors, data consistency and audit logs; escalate schema or migration problems.", "Never use test/reset actions on production data unless a safe, approved and verified procedure exists."]} routine={["Review new users and role assignments.", "Check failed operations and data-integrity warnings.", "Verify backups/migrations and deployment health where available.", "Test fixes with controlled test records and confirm real farm records remain intact."]} />
    <Panel title="Daily reconciliation checklist">
      <ul className="grid gap-2 sm:grid-cols-2">{["Sales invoice total agrees with Sales Analytics.", "Amount paid agrees with money received; unpaid balance is separate.", "Sales income is not entered a second time manually.", "Sold/dead/transferred animals are excluded from active stock.", "Goods received and stock issues change inventory once only.", "Expense totals follow approval and payment statuses.", "CEO Office and Dashboard figures reconcile for the same date range.", "Differences are investigated and documented—never hidden with duplicate entries."].map((item) => <li key={item} className="flex gap-2 text-sm"><ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{item}</span></li>)}</ul>
    </Panel>
    <p className="text-xs text-muted-foreground">Access to modules is still controlled by assigned permissions. This guide explains responsibilities; it does not grant additional permissions. {hasRole("ceo") || hasRole("administrator") ? "You have an executive/administrator role; use the access controls only for approved business needs." : "If you cannot access a module mentioned here, ask the Administrator to review your assigned permissions."}</p>
  </div>;
}
