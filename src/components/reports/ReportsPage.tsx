
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  Beef,
  Activity,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatNaira } from "@/lib/access";
import {
  PageHeader,
  RequirePermission,
} from "@/components/app/PageKit";
import { Button } from "@/components/ui/button";

type ReportTab = "profit" | "livestock" | "sales" | "activity";

const tabs: { id: ReportTab; label: string }[] = [
  { id: "profit", label: "Profit & Loss" },
  { id: "livestock", label: "Livestock" },
  { id: "sales", label: "Sales Analytics" },
  { id: "activity", label: "Activity Log" },
];

function StatCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-3 text-2xl font-bold">{value}</p>
    </div>
  );
}

function formatActivityDescription(item: {
  action: string | null;
  description: string | null;
  table_name: string | null;
  record_id: string | null;
}) {
  const savedDescription = item.description?.trim();
  if (savedDescription) return savedDescription;

  const actionLabels: Record<string, string> = {
    insert: "Created",
    update: "Updated",
    delete: "Deleted",
  };
  const action = (item.action ?? "").toLowerCase();
  const verb = actionLabels[action] ?? (action ? action[0].toUpperCase() + action.slice(1) : "Changed");
  const tableLabels: Record<string, string> = {
    animals: "animal record",
    animal_batches: "animal batch",
    inventory_items: "inventory item",
    inventory_transactions: "inventory transaction",
    role_permissions: "role permission",
    livestock_types: "livestock type",
    sales: "sale",
    expenses: "expense",
    income: "income record",
  };
  const table = item.table_name
    ? tableLabels[item.table_name] ?? item.table_name.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "record";
  const record = item.record_id ? ` (ID: ${item.record_id})` : "";
  return `${verb} ${table}${record}. Detailed description was not saved by the audit logger.`;
}

export function ReportsPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<ReportTab>("profit");
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const incomeQuery = useQuery({
    queryKey: ["reports-income"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income")
        .select("id, amount, category, received_on, status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const expensesQuery = useQuery({
    queryKey: ["reports-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, amount, category, spent_on, status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const salesQuery = useQuery({
    queryKey: ["reports-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(
          "id, invoice_number, sale_date, total_amount, amount_paid, payment_status, status",
        );
      if (error) throw error;
      return data ?? [];
    },
  });

  const animalsQuery = useQuery({
    queryKey: ["reports-animals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("animals")
        .select("id, tag_number, livestock_type_id, status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const batchesQuery = useQuery({
    queryKey: ["reports-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("animal_batches")
        .select("id, batch_code, livestock_type_id, current_quantity, status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const typesQuery = useQuery({
    queryKey: ["reports-livestock-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("livestock_types")
        .select("id, name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const activityQuery = useQuery({
    queryKey: ["reports-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select(
          "id, action, description, table_name, record_id, user_id, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const loading = [
    incomeQuery,
    expensesQuery,
    salesQuery,
    animalsQuery,
    batchesQuery,
    typesQuery,
    activityQuery,
  ].some((query) => query.isLoading);

  const errors = [
    incomeQuery,
    expensesQuery,
    salesQuery,
    animalsQuery,
    batchesQuery,
    typesQuery,
    activityQuery,
  ].some((query) => query.isError);

  const inPeriod = (date: string) =>
    date >= startDate && date <= endDate;

  const income = (incomeQuery.data ?? []).filter(
    (item) =>
      inPeriod(item.received_on) &&
      ["received", "approved"].includes(item.status),
  );

  const expenses = (expensesQuery.data ?? []).filter(
    (item) =>
      inPeriod(item.spent_on) && item.status === "approved",
  );

  const totalIncome = income.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );

  const totalExpenses = expenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );

  const sales = (salesQuery.data ?? []).filter(
    (item) =>
      inPeriod(item.sale_date) &&
      !["cancelled", "canceled", "void"].includes(
        item.status.toLowerCase(),
      ),
  );

  const totalSales = sales.reduce(
    (sum, item) => sum + Number(item.total_amount || 0),
    0,
  );

  const totalPaid = sales.reduce(
    (sum, item) => sum + Number(item.amount_paid || 0),
    0,
  );

  const animals = animalsQuery.data ?? [];
  const batches = batchesQuery.data ?? [];
  const livestockTypes = typesQuery.data ?? [];
  const activity = activityQuery.data ?? [];

  const typeName = (id: string) =>
    livestockTypes.find((item) => item.id === id)?.name ??
    "Uncategorised";

  const livestockSummary = livestockTypes.map((type) => ({
    name: type.name,
    animals: animals.filter(
      (animal) =>
        animal.livestock_type_id === type.id &&
        !["sold", "deceased", "dead", "disposed"].includes(
          animal.status.toLowerCase(),
        ),
    ).length,
    batchQuantity: batches
      .filter((batch) => batch.livestock_type_id === type.id)
      .reduce(
        (sum, batch) =>
          sum +
          (["active", "healthy"].includes(batch.status.toLowerCase())
            ? Number(batch.current_quantity || 0)
            : 0),
        0,
      ),
  }));

  const refresh = () => {
    window.location.reload();
  };

  return (
    <RequirePermission perm="reports.view">
      <div className="space-y-6">
        <PageHeader
          title="Reports & Analytics"
          description="Business performance reports for TOBADDY AGRO LIVESTOCK."
          actions={
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          }
        />

        {errors && (
          <div className="rounded-lg border border-destructive/40 p-4 text-sm">
            Some reports could not load. Check your database access
            policies and try refreshing.
          </div>
        )}

        <div className="flex flex-wrap items-end gap-4 rounded-xl border p-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Start date</label>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="block rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">End date</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setEndDate(event.target.value)}
              className="block rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Date filters apply to financial and sales reports.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-b pb-3">
          {tabs.map((item) => (
            <Button
              key={item.id}
              variant={tab === item.id ? "default" : "outline"}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-xl border p-10 text-center">
            Loading reports...
          </div>
        ) : (
          <>
            {tab === "profit" && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard
                    title="Recognised Income"
                    value={formatNaira(totalIncome)}
                  />
                  <StatCard
                    title="Approved Expenses"
                    value={formatNaira(totalExpenses)}
                  />
                  <StatCard
                    title="Net Operating Result"
                    value={formatNaira(totalIncome - totalExpenses)}
                  />
                </div>
                <div className="rounded-xl border">
                  <h2 className="border-b p-4 font-semibold">
                    Profit & Loss Breakdown
                  </h2>
                  {[...new Set([
                    ...income.map((item) => item.category),
                    ...expenses.map((item) => item.category),
                  ])].map((category) => {
                    const earned = income
                      .filter((item) => item.category === category)
                      .reduce((sum, item) => sum + Number(item.amount), 0);
                    const spent = expenses
                      .filter((item) => item.category === category)
                      .reduce((sum, item) => sum + Number(item.amount), 0);
                    return (
                      <div
                        key={category}
                        className="grid grid-cols-3 gap-2 border-b p-4 text-sm last:border-0"
                      >
                        <span>{category}</span>
                        <span className="text-right text-green-700">
                          {formatNaira(earned)}
                        </span>
                        <span className="text-right text-red-600">
                          {formatNaira(spent)}
                        </span>
                      </div>
                    );
                  })}
                  <div className="grid grid-cols-3 gap-2 bg-muted/40 p-4 text-sm font-semibold">
                    <span>Total</span>
                    <span className="text-right">{formatNaira(totalIncome)}</span>
                    <span className="text-right">{formatNaira(totalExpenses)}</span>
                  </div>
                  <p className="p-4 text-xs text-muted-foreground">
                    This is an operating summary based on recorded income
                    and approved expenses, not a full audited accounting
                    profit figure.
                  </p>
                </div>
              </div>
            )}

            {tab === "livestock" && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard
                    title="Individual Animal Records"
                    value={String(animals.length)}
                  />
                  <StatCard
                    title="Batch Records"
                    value={String(batches.length)}
                  />
                  <StatCard
                    title="Livestock Categories"
                    value={String(livestockTypes.length)}
                  />
                </div>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-4">Livestock type</th>
                        <th className="p-4">Individual records</th>
                        <th className="p-4">Active batch quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {livestockSummary.map((item) => (
                        <tr key={item.name} className="border-t">
                          <td className="p-4 font-medium">{item.name}</td>
                          <td className="p-4">{item.animals}</td>
                          <td className="p-4">{item.batchQuantity}</td>
                        </tr>
                      ))}
                      {livestockSummary.length === 0 && (
                        <tr>
                          <td colSpan={3} className="p-8 text-center">
                            No livestock categories found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Individual animal records and batch quantities are shown
                  separately to avoid double-counting them.
                </p>
              </div>
            )}

            {tab === "sales" && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard
                    title="Sales Value"
                    value={formatNaira(totalSales)}
                  />
                  <StatCard
                    title="Payments Received"
                    value={formatNaira(totalPaid)}
                  />
                  <StatCard
                    title="Outstanding Balance"
                    value={formatNaira(
                      sales.reduce(
                        (sum, item) =>
                          sum +
                          Math.max(
                            0,
                            Number(item.total_amount) -
                              Number(item.amount_paid),
                          ),
                        0,
                      ),
                    )}
                  />
                </div>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-4">Invoice</th>
                        <th className="p-4">Date</th>
                        <th className="p-4">Sale value</th>
                        <th className="p-4">Paid</th>
                        <th className="p-4">Payment status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((sale) => (
                        <tr key={sale.id} className="border-t">
                          <td className="p-4">{sale.invoice_number}</td>
                          <td className="p-4">{sale.sale_date}</td>
                          <td className="p-4">
                            {formatNaira(Number(sale.total_amount))}
                          </td>
                          <td className="p-4">
                            {formatNaira(Number(sale.amount_paid))}
                          </td>
                          <td className="p-4 capitalize">
                            {sale.payment_status}
                          </td>
                        </tr>
                      ))}
                      {sales.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center">
                            No sales in this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "activity" && (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-4">Date and time</th>
                      <th className="p-4">Action</th>
                      <th className="p-4">Description</th>
                      <th className="p-4">Table</th>
                      <th className="p-4">User ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="whitespace-nowrap p-4">
                          {new Date(item.created_at).toLocaleString()}
                        </td>
                        <td className="p-4">{item.action}</td>
                        <td className="p-4">{formatActivityDescription(item)}</td>
                        <td className="p-4">{item.table_name || "—"}</td>
                        <td className="p-4">{item.user_id || "—"}</td>
                      </tr>
                    ))}
                    {activity.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center">
                          No activity log entries found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <p className="border-t p-4 text-xs text-muted-foreground">
                  Displays up to the 100 most recent log entries. Actions
                  are shown only if they have been recorded in the activity
                  log table.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </RequirePermission>
  );
}

export default ReportsPage;

