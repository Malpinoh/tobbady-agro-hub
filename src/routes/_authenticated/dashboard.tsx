
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  PageHeader,
  Panel,
  StatusBadge,
  RequirePermission,
} from "@/components/app/PageKit";
import { formatNaira } from "@/lib/access";
import { supabase } from "@/integrations/supabase/client";
import { PendingApprovalsPanel } from "@/components/app/PendingApprovalsPanel";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard || TOBADDY AGRO LIVESTOCK" },
      {
        name: "description",
        content: "Live business overview dashboard.",
      },
    ],
  }),
  component: Dashboard,
});

const money = (value: number) => formatNaira(value);

const number = (value: unknown) => Number(value ?? 0);

function Dashboard() {
  const dashboardQuery = useQuery({
    queryKey: ["dashboard-live-data"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const [
        batchesResult,
        typesResult,
        animalsResult,
        salesResult,
        expensesResult,
        incomeResult,
        inventoryResult,
        saleItemsResult,
      ] = await Promise.all([
        supabase
          .from("animal_batches")
          .select("id, current_quantity, estimated_unit_value, livestock_type_id, status")
          .eq("approval_status", "approved"),
        supabase
          .from("livestock_types")
          .select("id, name, unit_label"),
        supabase
          .from("animals")
          .select("id, estimated_value, livestock_type_id, status")
          .eq("approval_status", "approved"),
        supabase
          .from("sales")
          .select("id, sale_date, total_amount, status"),
        supabase
          .from("expenses")
          .select("id, spent_on, amount, category, status"),
        supabase
          .from("income")
          .select("id, sale_id, category, received_on, amount, status"),
        supabase
          .from("inventory_items")
          .select("id, name, quantity_on_hand, reorder_level, unit")
          .eq("approval_status", "approved"),
        supabase.from("sale_items").select("sale_id, cost_total"),
      ]);

      const results = [
        ["livestock batches", batchesResult],
        ["livestock types", typesResult],
        ["individual animals", animalsResult],
        ["sales", salesResult],
        ["expenses", expensesResult],
        ["income ledger", incomeResult],
        ["inventory", inventoryResult],
        ["sale item costs", saleItemsResult],
      ] as const;

      for (const [source, result] of results) {
        if (result.error) {
          throw new Error(
            `Dashboard could not load ${source}: ${result.error.message}${result.error.code ? ` (code ${result.error.code})` : ""}`,
          );
        }
      }

      const batches = batchesResult.data ?? [];
      const types = typesResult.data ?? [];
      const animals = animalsResult.data ?? [];
      const activeAnimals = animals.filter(
        (animal) => String(animal.status ?? "").toLowerCase() === "active",
      );
      const sales = salesResult.data ?? [];
      const expenses = expensesResult.data ?? [];
      const income = incomeResult.data ?? [];
      const inventory = inventoryResult.data ?? [];

      const now = new Date();
      const today = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");
      const monthStart = `${today.slice(0, 7)}-01`;

      const activeBatches = batches.filter(
        (batch) =>
          String(batch.status ?? "").toLowerCase() === "active" &&
          number(batch.current_quantity) > 0,
      );

      const batchCount = activeBatches.reduce(
        (sum, batch) => sum + number(batch.current_quantity),
        0
      );

      const animalCount = activeAnimals.length;
      const totalLivestock = batchCount + animalCount;

      const batchValue = activeBatches.reduce(
        (sum, batch) =>
          sum +
          number(batch.current_quantity) *
            number(batch.estimated_unit_value),
        0
      );

      const animalValue = activeAnimals.reduce(
        (sum, animal) => sum + number(animal.estimated_value),
        0
      );

      const livestockSummary = types.map((type) => {
        const batchQuantity = activeBatches
          .filter((batch) => batch.livestock_type_id === type.id)
          .reduce(
            (sum, batch) => sum + number(batch.current_quantity),
            0
          );
        const individualQuantity = activeAnimals.filter(
          (animal) => animal.livestock_type_id === type.id,
        ).length;
        const quantity = batchQuantity + individualQuantity;

        return {
          id: type.id,
          name: type.name,
          unit: type.unit_label || "head",
          quantity,
        };
      });

      const recognisedSales = sales.filter((sale) => ["completed", "approved"].includes(String(sale.status ?? "").toLowerCase()));
      const todaySales = recognisedSales
        .filter((sale) => sale.sale_date === today)
        .reduce((sum, sale) => sum + number(sale.total_amount), 0);

      // Match the Profit & Loss report: only approved expenses affect this KPI.
      const isLivestockPurchase = (expense: { category?: string | null }) =>
        String(expense.category ?? "").trim().toLowerCase() === "livestock purchase";
      const todayApprovedExpenses = expenses.filter(
        (expense) => expense.spent_on === today && String(expense.status ?? "").toLowerCase() === "approved",
      );
      const todayExpenses = todayApprovedExpenses
        .filter((expense) => !isLivestockPurchase(expense))
        .reduce((sum, expense) => sum + number(expense.amount), 0);
      const todayLivestockPurchases = todayApprovedExpenses
        .filter(isLivestockPurchase)
        .reduce((sum, expense) => sum + number(expense.amount), 0);

      const monthOtherIncome = income
        .filter(
          (item) =>
            !item.sale_id &&
            String(item.category ?? "").trim().toLowerCase() !== "livestock sales" &&
            item.received_on >= monthStart &&
            item.received_on <= today &&
            ["received", "approved"].includes(String(item.status ?? "").toLowerCase())
        )
        .reduce((sum, item) => sum + number(item.amount), 0);
      const monthSales = recognisedSales
        .filter((sale) => sale.sale_date >= monthStart && sale.sale_date <= today)
        .reduce((sum, sale) => sum + number(sale.total_amount), 0);
      const monthSaleIds = new Set(recognisedSales.filter((sale) => sale.sale_date >= monthStart && sale.sale_date <= today).map((sale) => sale.id));
      const monthCostOfGoodsSold = (saleItemsResult.data ?? [])
        .filter((item) => monthSaleIds.has(item.sale_id))
        .reduce((sum, item) => sum + number(item.cost_total), 0);
      const monthIncome = monthOtherIncome + monthSales;

      // Keep Dashboard expenses aligned with Reports & Analytics (approved only).
      const monthApprovedExpenses = expenses.filter(
        (expense) => expense.spent_on >= monthStart && expense.spent_on <= today && String(expense.status ?? "").toLowerCase() === "approved",
      );
      const monthExpenses = monthApprovedExpenses
        .filter((expense) => !isLivestockPurchase(expense))
        .reduce((sum, expense) => sum + number(expense.amount), 0);
      const monthLivestockPurchases = monthApprovedExpenses
        .filter(isLivestockPurchase)
        .reduce((sum, expense) => sum + number(expense.amount), 0);

      const lowStock = inventory.filter(
        (item) =>
          item.reorder_level != null &&
          number(item.quantity_on_hand) <= number(item.reorder_level)
      );

      return {
        totalLivestock,
        livestockValue: batchValue + animalValue,
        todaySales,
        todayExpenses,
        todayLivestockPurchases,
        monthlyRevenue: monthIncome,
        monthlyExpenses: monthExpenses,
        monthlyLivestockPurchases: monthLivestockPurchases,
        monthlyCostOfGoodsSold: monthCostOfGoodsSold,
        estimatedProfit: monthIncome - monthExpenses - monthCostOfGoodsSold,
        livestockSummary,
        lowStock,
        recentSales: [...sales]
          .filter((sale) => ["completed", "approved"].includes(String(sale.status ?? "").toLowerCase()))
          .sort((a, b) => b.sale_date.localeCompare(a.sale_date))
          .slice(0, 5),
        recentExpenses: [...expenses]
          .filter((expense) => String(expense.status ?? "").toLowerCase() === "approved")
          .sort((a, b) => b.spent_on.localeCompare(a.spent_on))
          .slice(0, 5),
      };
    },
  });

  const data = dashboardQuery.data;
  const livestockChartData = (data?.livestockSummary ?? []).map((item) => ({
    type: item.name,
    quantity: item.quantity,
  }));

  const stats = [
    ["Total Livestock", data?.totalLivestock.toLocaleString() ?? "—"],
    ["Estimated Livestock Value", data ? money(data.livestockValue) : "—"],
    ["Today's Sales Revenue", data ? money(data.todaySales) : "—"],
    ["Today's Operating Expenses", data ? money(data.todayExpenses) : "—"],
    ["Today's Livestock Purchases", data ? money(data.todayLivestockPurchases) : "—"],
    ["Monthly Revenue", data ? money(data.monthlyRevenue) : "—"],
    ["Cost of Livestock Sold", data ? money(data.monthlyCostOfGoodsSold) : "—"],
    ["Monthly Operating Expenses", data ? money(data.monthlyExpenses) : "—"],
    ["Monthly Livestock Purchases", data ? money(data.monthlyLivestockPurchases) : "—"],
    ["Estimated Profit / Loss", data ? money(data.estimatedProfit) : "—"],
  ];

  return (
    <RequirePermission perm="dashboard.view">
      <PageHeader
        title="Business Dashboard"
        description="TOBADDY AGRO LIVESTOCK at a glance."
      />

      <PendingApprovalsPanel />

      {dashboardQuery.isPending ? (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground">
          Loading live business data…
        </div>
      ) : dashboardQuery.isError ? (
        <div className="rounded-xl border border-destructive p-5">
          <p className="font-semibold">Unable to load dashboard data</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {dashboardQuery.error instanceof Error
              ? dashboardQuery.error.message
              : "Check your Supabase connection, database tables, and permissions."}
          </p>
          <button
            type="button"
            className="mt-4 rounded-md border px-4 py-2 text-sm"
            onClick={() => dashboardQuery.refetch()}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border bg-card p-5 shadow-card"
              >
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {label}
                </div>
                <div className={`mt-2 font-display text-2xl font-bold tabular-nums ${label.includes("Cost of Livestock") || label.includes("Livestock Purchase") ? "text-amber-700" : label.includes("Expense") ? "text-red-600" : label.includes("Profit") ? (data && data.estimatedProfit < 0 ? "text-red-600" : "text-green-700") : label.includes("Livestock") ? "text-blue-600" : ""}`}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Panel title="Livestock distribution">
              {livestockChartData.length ? (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={livestockChartData} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="quantity" name="Animals / head count" fill="#2563eb" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-muted-foreground">Livestock charts will appear when livestock records exist.</p>}
            </Panel>
            <Panel title="This month's finance snapshot">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="mt-1 text-lg font-semibold text-green-700">{data ? money(data.monthlyRevenue) : "—"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Approved Operating Expenses</p>
                  <p className="mt-1 text-lg font-semibold text-red-600">{data ? money(data.monthlyExpenses) : "—"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Livestock Purchases</p>
                  <p className="mt-1 text-lg font-semibold text-amber-700">{data ? money(data.monthlyLivestockPurchases) : "—"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Cost of Livestock Sold</p>
                  <p className="mt-1 text-lg font-semibold text-amber-700">{data ? money(data.monthlyCostOfGoodsSold) : "—"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Estimated Profit / Loss</p>
                  <p className={`mt-1 text-lg font-semibold ${data && data.estimatedProfit < 0 ? "text-red-600" : "text-green-700"}`}>{data ? money(data.estimatedProfit) : "—"}</p>
                </div>
              </div>
              <div className="mt-4 h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{ period: "Current month", revenue: data?.monthlyRevenue ?? 0, expenses: data?.monthlyExpenses ?? 0, costOfGoodsSold: data?.monthlyCostOfGoodsSold ?? 0 }]} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis tickFormatter={(value) => `₦${Number(value).toLocaleString("en-NG")}`} />
                    <Tooltip formatter={(value) => money(Number(value ?? 0))} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#16a34a" />
                    <Bar dataKey="expenses" name="Approved operating expenses" fill="#dc2626" />
                    <Bar dataKey="costOfGoodsSold" name="Cost of livestock sold" fill="#d97706" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Panel title="Livestock summary" className="lg:col-span-2">
              {data?.livestockSummary.length ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {data.livestockSummary.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border bg-background p-4"
                    >
                      <div className="text-sm text-muted-foreground">
                        {item.name}
                      </div>
                      <div className="font-display text-xl font-bold tabular-nums">
                        {item.quantity.toLocaleString()}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {item.unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No livestock types have been added yet.
                </p>
              )}
            </Panel>

            <Panel title="Important alerts">
              {data?.lowStock.length ? (
                <ul className="space-y-3 text-sm">
                  {data.lowStock.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-2"
                    >
                      <span>
                        {item.name}: {number(item.quantity_on_hand)}{" "}
                        {item.unit}
                      </span>
                      <StatusBadge tone="danger">Low stock</StatusBadge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No low-stock items found, or inventory is empty.
                </p>
              )}
            </Panel>

            <Panel title="Recent sales">
              {data?.recentSales.length ? (
                <ul className="space-y-3 text-sm">
                  {data.recentSales.map((sale) => (
                    <li
                      key={sale.id}
                      className="flex justify-between gap-3"
                    >
                      <span>{sale.sale_date}</span>
                      <span className="font-medium">
                        {money(number(sale.total_amount))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No sales recorded yet.
                </p>
              )}
            </Panel>

            <Panel title="Recent expenses">
              {data?.recentExpenses.length ? (
                <ul className="space-y-3 text-sm">
                  {data.recentExpenses.map((expense) => (
                    <li
                      key={expense.id}
                      className="flex justify-between gap-3"
                    >
                      <span>{expense.category} · {expense.spent_on}</span>
                      <span className="font-medium">
                        {money(number(expense.amount))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No expenses recorded yet.
                </p>
              )}
            </Panel>

            <Panel title="Dashboard status">
              <div className="flex items-center gap-2 text-sm">
                <StatusBadge tone="success">Connected</StatusBadge>
                Dashboard data loaded from Supabase.
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Sales revenue is the full value of completed invoices; cash received is tracked separately. Estimated profit/loss = sales revenue + other recognised income − approved operating expenses − cost of livestock sold. Livestock purchases are shown separately and their cost is recognised when those animals are sold.
              </p>
            </Panel>
          </div>
        </>
      )}
    </RequirePermission>
  );
}
