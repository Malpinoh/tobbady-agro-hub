import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, RefreshCw, Building2 } from "lucide-react";
import {
  PageHeader,
  Panel,
  RequirePermission,
  StatusBadge,
} from "@/components/app/PageKit";
import { formatNaira } from "@/lib/access";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ceo-office")({
  head: () => ({
    meta: [
      { title: "CEO Office — TOBADDY AGRO LIVESTOCK" },
      {
        name: "description",
        content: "Executive overview and live farm performance.",
      },
    ],
  }),
  component: CEOOffice,
});

const money = (value: number) => formatNaira(value);
const amount = (value: unknown) => Number(value ?? 0);

function CEOOffice() {
  const query = useQuery({
    queryKey: ["ceo-office-live-data"],
    queryFn: async () => {
      const [
        batchesResult,
        animalsResult,
        salesResult,
        expensesResult,
        incomeResult,
        inventoryResult,
      ] = await Promise.all([
        supabase
          .from("animal_batches")
          .select("id, current_quantity, estimated_unit_value, status"),
        supabase.from("animals").select("id, estimated_value"),
        supabase.from("sales").select(
          "id, sale_date, total_amount, status"
        ),
        supabase.from("expenses").select(
          "id, spent_on, amount, status"
        ),
        supabase.from("income").select(
          "id, received_on, amount, status"
        ),
        supabase.from("inventory_items").select(
          "id, name, quantity_on_hand, reorder_level"
        ),
      ]);

      const results = [
        batchesResult,
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
      const animals = animalsResult.data ?? [];
      const sales = salesResult.data ?? [];
      const expenses = expensesResult.data ?? [];
      const income = incomeResult.data ?? [];
      const inventory = inventoryResult.data ?? [];

      const today = new Date().toLocaleDateString("en-CA");
      const monthStart = `${today.slice(0, 7)}-01`;

      const validSales = sales.filter(
        (s) => s.status !== "cancelled" && s.status !== "void"
      );

      const validExpenses = expenses.filter(
        (e) => e.status !== "cancelled" && e.status !== "rejected"
      );

      const validIncome = income.filter(
        (i) => i.status !== "cancelled" && i.status !== "rejected"
      );

      const activeBatches = batches.filter(
        (b) => b.status !== "sold" && b.status !== "inactive"
      );

      const livestockCount =
        activeBatches.reduce(
          (sum, b) => sum + amount(b.current_quantity),
          0
        ) + animals.length;

      const livestockValue =
        activeBatches.reduce(
          (sum, b) =>
            sum +
            amount(b.current_quantity) *
              amount(b.estimated_unit_value),
          0
        ) +
        animals.reduce(
          (sum, a) => sum + amount(a.estimated_value),
          0
        );

      const monthlySales = validSales
        .filter((s) => s.sale_date >= monthStart && s.sale_date <= today)
        .reduce((sum, s) => sum + amount(s.total_amount), 0);

      const monthlyIncome = validIncome
        .filter(
          (i) => i.received_on >= monthStart && i.received_on <= today
        )
        .reduce((sum, i) => sum + amount(i.amount), 0);

      const monthlyExpenses = validExpenses
        .filter(
          (e) => e.spent_on >= monthStart && e.spent_on <= today
        )
        .reduce((sum, e) => sum + amount(e.amount), 0);

      const todaySales = validSales
        .filter((s) => s.sale_date === today)
        .reduce((sum, s) => sum + amount(s.total_amount), 0);

      const lowStock = inventory.filter(
        (item) =>
          item.reorder_level != null &&
          amount(item.quantity_on_hand) <= amount(item.reorder_level)
      );

      return {
        livestockCount,
        livestockValue,
        todaySales,
        monthlySales,
        monthlyIncome,
        monthlyExpenses,
        estimatedProfit:
          monthlySales + monthlyIncome - monthlyExpenses,
        lowStock,
        recentSales: [...validSales]
          .sort((a, b) => b.sale_date.localeCompare(a.sale_date))
          .slice(0, 5),
      };
    },
  });

  const data = query.data;

  const stats = [
    {
      label: "Livestock Count",
      value: data?.livestockCount.toLocaleString() ?? "—",
    },
    {
      label: "Estimated Livestock Value",
      value: data ? money(data.livestockValue) : "—",
    },
    {
      label: "Today's Sales",
      value: data ? money(data.todaySales) : "—",
    },
    {
      label: "Monthly Revenue",
      value: data
        ? money(data.monthlySales + data.monthlyIncome)
        : "—",
    },
    {
      label: "Monthly Expenses",
      value: data ? money(data.monthlyExpenses) : "—",
    },
    {
      label: "Estimated Monthly Surplus",
      value: data ? money(data.estimatedProfit) : "—",
    },
  ];

  return (
    <RequirePermission perm="ceo.view">
      <PageHeader
        title="CEO Office"
        description="Executive oversight of TOBADDY AGRO LIVESTOCK."
        actions={
          <button
            type="button"
            onClick={() => query.refetch()}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh data
          </button>
        }
      />

      <div className="mb-6 flex items-start gap-3 rounded-xl border bg-card p-4">
        <Building2 className="mt-1 h-5 w-5 text-primary" />
        <div className="flex-1">
          <h2 className="font-semibold">Executive overview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor the farm's financial performance, livestock
            position, and operational issues from one place.
          </p>
        </div>
        <StatusBadge tone="info">Live data</StatusBadge>
      </div>

      {query.isPending ? (
        <Panel title="Loading executive data">
          Please wait while farm records are retrieved.
        </Panel>
      ) : query.isError ? (
        <Panel title="Unable to load executive data">
          <p className="text-sm text-muted-foreground">
            Check the Supabase connection, table permissions, and
            database schema.
          </p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="mt-4 rounded-lg border px-4 py-2 text-sm"
          >
            Try again
          </button>
        </Panel>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((stat) => (
              <Panel key={stat.label}>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums">
                  {stat.value}
                </p>
              </Panel>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel title="Management alerts">
              {data.lowStock.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No inventory items currently meet the low-stock
                  threshold.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.lowStock.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <span className="text-sm font-medium">
                        {item.name}
                      </span>
                      <StatusBadge tone="warning">
                        Reorder needed
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Recent sales">
              {data.recentSales.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sales records found.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.recentSales.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between gap-3 border-b pb-3 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          Sale record
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sale.sale_date}
                        </p>
                      </div>
                      <span className="text-sm font-semibold">
                        {money(amount(sale.total_amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
          
          <Panel title="Executive Approvals" className="mt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  Executive decision centre
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review business requests and record executive decisions.
                </p>
              </div>
              <StatusBadge tone="warning">
                Database setup required
              </StatusBadge>
            </div>

            <div className="rounded-xl border border-dashed p-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <span className="text-xl">✓</span>
              </div>

              <h3 className="font-semibold">
                Approval records are not connected yet
              </h3>

              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                Once the approval database is configured, this section
                will show pending requests, approval history, request
                details, amounts, and the person responsible for each
                decision.
              </p>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-lg border px-4 py-2 text-sm opacity-50"
                >
                  Approve request
                </button>

                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-lg border px-4 py-2 text-sm opacity-50"
                >
                  Reject request
                </button>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Decisions are disabled until secure database storage
                and permissions are configured.
              </p>
            </div>
          </Panel>

          <Panel title="Executive shortcuts" className="mt-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: "Finance",
                  description: "Review income and expenses",
                  to: "/finance",
                },
                {
                  label: "Farm Operations",
                  description: "Manage livestock operations",
                  to: "/farm-operations",
                },
                {
                  label: "Inventory",
                  description: "Review supplies and stock",
                  to: "/inventory",
                },
                {
                  label: "Reports & Analytics",
                  description: "Review business reports",
                  to: "/reports",
                },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:bg-muted"
                >
                  <div>
                    <p className="font-semibold">{item.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
              ))}
            </div>
          </Panel>
        </>
      ) : null}
    </RequirePermission>
  );
}
