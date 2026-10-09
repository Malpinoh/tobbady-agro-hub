
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
    queryFn: async () => {
      const [
        batchesResult,
        typesResult,
        animalsResult,
        salesResult,
        expensesResult,
        incomeResult,
        inventoryResult,
      ] = await Promise.all([
        supabase
          .from("animal_batches")
          .select("id, current_quantity, estimated_unit_value, livestock_type_id, status"),
        supabase
          .from("livestock_types")
          .select("id, name, unit_label"),
        supabase
          .from("animals")
          .select("id, estimated_value"),
        supabase
          .from("sales")
          .select("id, sale_date, total_amount, status"),
        supabase
          .from("expenses")
          .select("id, spent_on, amount, status"),
        supabase
          .from("income")
          .select("id, received_on, amount, status"),
        supabase
          .from("inventory_items")
          .select("id, name, quantity_on_hand, reorder_level, unit"),
      ]);

      const results = [
        batchesResult,
        typesResult,
        animalsResult,
        salesResult,
        expensesResult,
        incomeResult,
        inventoryResult,
      ];

      for (const result of results) {
        if (result.error) throw result.error;
      }

      const batches = batchesResult.data ?? [];
      const types = typesResult.data ?? [];
      const animals = animalsResult.data ?? [];
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
        (batch) => batch.status !== "sold" && batch.status !== "inactive"
      );

      const batchCount = activeBatches.reduce(
        (sum, batch) => sum + number(batch.current_quantity),
        0
      );

      const animalCount = animals.length;
      const totalLivestock = batchCount + animalCount;

      const batchValue = activeBatches.reduce(
        (sum, batch) =>
          sum +
          number(batch.current_quantity) *
            number(batch.estimated_unit_value),
        0
      );

      const animalValue = animals.reduce(
        (sum, animal) => sum + number(animal.estimated_value),
        0
      );

      const livestockSummary = types.map((type) => {
        const quantity = activeBatches
          .filter((batch) => batch.livestock_type_id === type.id)
          .reduce(
            (sum, batch) => sum + number(batch.current_quantity),
            0
          );

        return {
          id: type.id,
          name: type.name,
          unit: type.unit_label || "head",
          quantity,
        };
      });

      const todaySales = sales
        .filter(
          (sale) =>
            sale.sale_date === today &&
            sale.status !== "cancelled" &&
            sale.status !== "void"
        )
        .reduce((sum, sale) => sum + number(sale.total_amount), 0);

      const todayExpenses = expenses
        .filter(
          (expense) =>
            expense.spent_on === today &&
            expense.status !== "cancelled" &&
            expense.status !== "rejected"
        )
        .reduce((sum, expense) => sum + number(expense.amount), 0);

      const monthSales = sales
        .filter(
          (sale) =>
            sale.sale_date >= monthStart &&
            sale.sale_date <= today &&
            sale.status !== "cancelled" &&
            sale.status !== "void"
        )
        .reduce((sum, sale) => sum + number(sale.total_amount), 0);

      const monthIncome = income
        .filter(
          (item) =>
            item.received_on >= monthStart &&
            item.received_on <= today &&
            item.status !== "cancelled" &&
            item.status !== "rejected"
        )
        .reduce((sum, item) => sum + number(item.amount), 0);

      const monthExpenses = expenses
        .filter(
          (expense) =>
            expense.spent_on >= monthStart &&
            expense.spent_on <= today &&
            expense.status !== "cancelled" &&
            expense.status !== "rejected"
        )
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
        monthlyRevenue: monthSales + monthIncome,
        monthlyExpenses: monthExpenses,
        estimatedProfit: monthSales + monthIncome - monthExpenses,
        livestockSummary,
        lowStock,
        recentSales: [...sales]
          .filter(
            (sale) =>
              sale.status !== "cancelled" && sale.status !== "void"
          )
          .sort((a, b) => b.sale_date.localeCompare(a.sale_date))
          .slice(0, 5),
        recentExpenses: [...expenses]
          .sort((a, b) => b.spent_on.localeCompare(a.spent_on))
          .slice(0, 5),
      };
    },
  });

  const data = dashboardQuery.data;

  const stats = [
    ["Total Livestock", data?.totalLivestock.toLocaleString() ?? "—"],
    ["Estimated Livestock Value", data ? money(data.livestockValue) : "—"],
    ["Today's Sales", data ? money(data.todaySales) : "—"],
    ["Today's Expenses", data ? money(data.todayExpenses) : "—"],
    ["Monthly Revenue", data ? money(data.monthlyRevenue) : "—"],
    ["Monthly Expenses", data ? money(data.monthlyExpenses) : "—"],
    ["Estimated Profit", data ? money(data.estimatedProfit) : "—"],
  ];

  return (
    <RequirePermission perm="dashboard.view">
      <PageHeader
        title="Business Dashboard"
        description="TOBADDY AGRO LIVESTOCK at a glance."
      />

      {dashboardQuery.isPending ? (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground">
          Loading live business data…
        </div>
      ) : dashboardQuery.isError ? (
        <div className="rounded-xl border border-destructive p-5">
          <p className="font-semibold">Unable to load dashboard data</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Check your Supabase connection, database tables, and permissions.
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
                <div className="mt-2 font-display text-2xl font-bold tabular-nums">
                  {value}
                </div>
              </div>
            ))}
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
                      <span>{expense.spent_on}</span>
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
                Revenue and expenses are calculated from records available in
                the database for the current month.
              </p>
            </Panel>
          </div>
        </>
      )}
    </RequirePermission>
  );
}
