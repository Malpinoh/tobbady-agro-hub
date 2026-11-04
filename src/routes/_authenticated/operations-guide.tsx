import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, Crown, FileText, ShieldCheck, Tractor } from "lucide-react";
import { PageHeader, Panel } from "@/components/app/PageKit";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/operations-guide")({
  head: () => ({ meta: [{ title: "Operations Guide — TOBADDY AGRO LIVESTOCK" }, { name: "description", content: "Practical instructions for the CEO, Secretary, Farm Administrator and system Administrator." }] }),
  component: OperationsGuidePage,
});

const modules = [
  { title: "Dashboard", purpose: "Use the dashboard for a quick overview of livestock, sales, money received, expenses and alerts. It is a summary, not the place to correct a transaction." },
  { title: "Farm Operations", purpose: "Keep farm details and locations accurate. Assign animals to a real named section or describe their actual open-compound location." },
  { title: "Livestock", purpose: "Register individual animals and supported batches with the correct type, breed, sex, quantity, location and status. Record sales, mortality and movements against the correct animal or batch." },
  { title: "Livestock Setup", purpose: "Maintain animal groups, types and breeds. Check existing records before changing or removing setup values so historical livestock records remain valid." },
  { title: "Inventory", purpose: "Track feed, medicine and other supplies. Record stock received, issued, adjusted or transferred with the correct item, quantity, unit, date and cost." },
  { title: "Suppliers & Procurement", purpose: "Maintain supplier details and record purchases. Add stock only after the delivery has physically arrived and been checked." },
  { title: "Sales & Customers", purpose: "Record sales for individual animals or batches and capture full, partial or outstanding customer payments against the correct sale." },
  { title: "Finance", purpose: "Review income, receipts, expenses, payment status and approvals. Do not enter a sale again as separate income when it is already recorded in Sales." },
  { title: "Reports & Analytics", purpose: "Use consistent date ranges when comparing reports. Sales revenue, cash received, expenses, cost of livestock sold and profit are different measures." },
  { title: "Approvals & Activity", purpose: "Review submitted change and deletion requests, their decisions and available activity history. Keep reasons and supporting evidence for corrections." },
  { title: "Staff & Settings", purpose: "Manage access only for authorised users. Give each person the minimum permissions required for their responsibilities." },
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
    <PageHeader title="How to Use the System" description="Practical operating instructions for the CEO, Secretary, Farm Administrator and system Administrator." actions={<Button asChild variant="outline"><Link to="/dashboard">Back to Dashboard</Link></Button>} />
    <Panel title="Start here — recording information safely">
      <p className="text-sm leading-6 text-muted-foreground">Use the correct page for each task. Enter accurate information, save once and wait for confirmation. Then check the saved record and its related summary. If a save reports an error, inspect the record list or history before trying again so you do not create duplicates. Never change a real farm record just to make a dashboard total look right.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{modules.map((module) => <div key={module.title} className="rounded-lg border p-4"><h3 className="font-semibold">{module.title}</h3><p className="mt-1 text-sm leading-5 text-muted-foreground">{module.purpose}</p></div>)}</div>
    </Panel>
    <RolePanel title="CEO — Oversight and decisions" icon={Crown} purpose="The CEO monitors the whole farm, reviews important records and makes decisions or approvals assigned to the CEO role." responsibilities={["Review the Dashboard and CEO Office summaries and investigate unusual movements.", "Review sales, actual cash received, unpaid bills, expenses, livestock value and profit as separate measures.", "Review pending approval requests and supporting evidence before approving or rejecting.", "Protect official farm setup and historical records; use controlled correction workflows rather than deleting change history."]} routine={["Review daily activity, pending approvals and critical alerts.", "Compare sales, finance and reports for the same reporting period.", "Review livestock counts, inventory exceptions and feeding costs by inventory type.", "Review month-end reports and document decisions or unresolved differences."]} />
    <RolePanel title="Secretary — Records and accounts" icon={FileText} purpose="The Secretary records day-to-day sales, receipts, income and expenses, maintains supporting documents and submits changes that require management approval." responsibilities={["Record each sale once, then add payments received against that sale; keep partial payments and outstanding balances accurate.", "Enter expenses with the correct category, date, amount, payment details and supporting evidence.", "Maintain customer and supplier details and prepare reports using the correct date range.", "Use My Submitted Changes to monitor submitted edits, mortality/change requests and deletion requests."]} routine={["Check pending work and approval queues before entering a new transaction.", "Check My Submitted Changes for Pending, Approved or Rejected status.", "If a request is rejected, read the reason, correct the source information and resubmit only when appropriate.", "Reconcile sales, payments, expenses and supporting documents at the end of each workday."]} />
    <RolePanel title="Farm Administrator — Livestock operations" icon={Tractor} purpose="The Farm Administrator maintains accurate animal and batch records and records daily livestock activities, stock counts and feed usage." responsibilities={["Register each animal or batch with the correct livestock type, breed, sex, starting quantity and location.", "Record mortality against the correct individual animal or batch; verify the remaining live quantity after saving.", "Record feed and other inventory issues with the correct item and livestock attribution where the workflow provides it.", "Keep animal movements, purchases, weighing, treatment and stock counts aligned with actual farm activity."]} routine={["Check individual livestock counts by animal type and sex, as well as batch quantities.", "Compare physical stock with system records and report differences promptly.", "Review feed usage and inventory balances; report unusual consumption or low stock.", "Confirm sold, dead or transferred animals are no longer counted as active stock."]} />
    <RolePanel title="System Administrator — Access and configuration" icon={ShieldCheck} purpose="The system Administrator manages authorised accounts, permissions and configuration, and helps protect the integrity of farm records." responsibilities={["Manage staff accounts, roles and permissions according to approved responsibilities.", "Maintain livestock types, breeds and configuration without orphaning existing records.", "Check system errors, data consistency and audit logs; escalate database or update problems.", "Never run test or reset actions on production data unless a safe, approved and verified procedure exists."]} routine={["Review new users and role assignments.", "Check failed operations and warnings about incorrect records.", "Verify backups and database updates where those controls are available.", "Test fixes with controlled test records and confirm real farm records remain intact."]} />
    <Panel title="How change approvals work">
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
        <li>An authorised staff member submits a change or deletion request through the relevant workflow.</li>
        <li>The Secretary can open My Submitted Changes in the Secretary Office to see the request status: Pending, Approved or Rejected.</li>
        <li>The CEO or authorised approver reviews the request and its supporting details before making a decision.</li>
        <li>After the decision is saved, the requester checks the status again. The panel refreshes periodically; reload the page if the latest decision is not yet visible.</li>
        <li>Do not submit the same request repeatedly while it is pending. If rejected, read the reason and correct the information before submitting another request where appropriate.</li>
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">The submitted-changes panel reflects requests stored in the change-request and deletion-request workflows. It is not a claim that every ordinary new record or stock movement requires approval.</p>
    </Panel>
    <Panel title="Livestock, feeding and inventory procedures">
      <ul className="space-y-2 text-sm leading-6">
        <li>• For individual animals, check the animal type, breed, sex, tag/reference, location and current status before saving.</li>
        <li>• Review counts by individual animal type and sex—for example, female cattle and male goats. Do not combine different species into one count.</li>
        <li>• For batches, compare the opening quantity with mortality, sales and other movements to confirm the remaining live quantity.</li>
        <li>• When receiving stock, select the correct inventory item and movement type, then enter the actual quantity, unit, cost and date. Confirm the transaction appears in stock history.</li>
        <li>• When issuing feed, select the correct inventory item and livestock/batch attribution when those fields are available. Review feeding expenses by inventory type in the CEO view.</li>
        <li>• If a stock movement fails, read the error, check required fields and current stock, and confirm no transaction was saved before retrying.</li>
      </ul>
    </Panel>
    <Panel title="Daily reconciliation checklist">
      <ul className="grid gap-2 sm:grid-cols-2">{["Each sales bill agrees with the saved sales record.", "Amount paid agrees with money received; unpaid balance remains separate.", "A sale is not entered a second time as manual income.", "Sold and dead livestock are excluded from active stock.", "Goods received and stock issues change inventory once only.", "Feed issues use the correct inventory item and livestock attribution where available.", "Expense totals reflect the correct dates and approval/payment statuses.", "Dashboard, CEO Office and reports are compared using the same date range.", "Differences are investigated and documented, not hidden with duplicate entries."].map((item) => <li key={item} className="flex gap-2 text-sm"><ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{item}</span></li>)}</ul>
    </Panel>
    <p className="text-xs text-muted-foreground">Access to modules is controlled by assigned permissions. This guide explains operating responsibilities; it does not grant additional permissions. {hasRole("ceo") || hasRole("administrator") ? "Use executive or administrator access only for approved business needs." : "If you cannot access a module mentioned here, ask the system Administrator to review your assigned permissions."}</p>
  </div>;
}
