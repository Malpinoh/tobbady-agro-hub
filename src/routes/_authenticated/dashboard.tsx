import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, DemoTag, StatusBadge, RequirePermission } from "@/components/app/PageKit";
import { formatNaira } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — TOBADDY AGRO LIVESTOCK" }, { name: "description", content: "Business overview dashboard." }, { property: "og:title", content: "Dashboard — TOBADDY AGRO LIVESTOCK" }, { property: "og:description", content: "Business overview dashboard." }] }),
  component: Dashboard,
});

// Demo values only — replace with database queries in later stages.
const STATS = [
  ["Total Livestock", "2,486"], ["Est. Livestock Value", formatNaira(48250000)], ["Today's Sales", formatNaira(685000)],
  ["Today's Expenses", formatNaira(212500)], ["Monthly Revenue", formatNaira(9840000)], ["Monthly Expenses", formatNaira(5120000)], ["Est. Profit", formatNaira(4720000)],
];
const LIVESTOCK = [["Cattle", 48, "head"], ["Goats", 126, "head"], ["Rams/Sheep", 92, "head"], ["Turkeys", 220, "birds"], ["Broilers", 1450, "birds"], ["Noilers", 550, "birds"]] as const;

function Dashboard() {
  return (
    <RequirePermission perm="dashboard.view">
      <PageHeader title="Business Dashboard" description="TOBADDY AGRO LIVESTOCK at a glance." actions={<DemoTag />} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map(([l, v]) => (
          <div key={l} className="rounded-xl border bg-card p-5 shadow-card">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{l}</div>
            <div className="mt-2 font-display text-2xl font-bold tabular">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Livestock summary" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {LIVESTOCK.map(([n, c, u]) => (
              <div key={n} className="rounded-lg border bg-background p-4">
                <div className="text-sm text-muted-foreground">{n}</div>
                <div className="font-display text-xl font-bold tabular">{c.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{u}</span></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Important alerts">
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between gap-2">Broiler feed stock low <StatusBadge tone="danger">Urgent</StatusBadge></li>
            <li className="flex justify-between gap-2">Goat vaccination due <StatusBadge tone="warning">This week</StatusBadge></li>
            <li className="flex justify-between gap-2">3 expenses awaiting approval <StatusBadge tone="info">Pending</StatusBadge></li>
          </ul>
        </Panel>
        <Panel title="Recent sales"><p className="text-sm text-muted-foreground">Sales will appear here once the Sales module is built.</p></Panel>
        <Panel title="Recent expenses"><p className="text-sm text-muted-foreground">Expenses will appear here once the Finance module is built.</p></Panel>
        <Panel title="Pending approvals"><p className="text-sm text-muted-foreground">Nothing awaiting your approval.</p></Panel>
      </div>
    </RequirePermission>
  );
}
