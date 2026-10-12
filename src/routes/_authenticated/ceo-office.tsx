import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, RefreshCw, Building2, Download, FileText, Upload, Users } from "lucide-react";
import {
  PageHeader,
  Panel,
  RequirePermission,
  StatusBadge,
} from "@/components/app/PageKit";
import { formatNaira } from "@/lib/access";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

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
  const { can, hasRole } = useAuth();
  const canUploadBoardDocuments = can("documents.manage");
  const canViewBoardDocuments = hasRole("ceo") || hasRole("administrator");
  const [selectedDocument, setSelectedDocument] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentCategory, setDocumentCategory] = useState("Meeting minutes");
  const documentFileInputRef = useRef<HTMLInputElement>(null);
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
        "id, spent_on, amount, status, payment_status"
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

      const validExpenses = expenses.filter((e) => e.status === "approved");

      const validIncome = income.filter((i) => ["received", "approved"].includes(i.status));

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
          monthlyIncome - monthlyExpenses,
        lowStock,
        recentSales: [...validSales]
          .sort((a, b) => b.sale_date.localeCompare(a.sale_date))
          .slice(0, 5),
      };
    },
  });

  const data = query.data;
  
  const approvalsQuery = useQuery({
    queryKey: ["ceo-executive-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("executive_approvals")
        
.select(
  "id, title, request_details, amount, status, requested_by, decision_notes, created_at, payment_status, paid_at, paid_by, expense_id"
)

        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const approvals = approvalsQuery.data ?? [];
  const pendingApprovals = approvals.filter(
    (approval) => approval.status === "pending"
  );
  
  const targetsQuery = useQuery({
    queryKey: ["ceo-business-targets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_targets")
        .select(
          "id, title, metric, target_value, period_start, period_end, notes"
        )
        .order("period_start", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const targetMutation = useMutation({
    mutationFn: async (target: {
      title: string;
      metric: string;
      target_value: number;
      period_start: string;
      period_end: string;
      notes: string | null;
    }) => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in first.");

      const { error } = await supabase
        .from("business_targets")
        .insert({ ...target, created_by: user.id });

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["ceo-business-targets"],
      });
    },
  });

  const queryClient = useQueryClient();

  const documentsQuery = useQuery({
    queryKey: ["board-documents-library"],
    enabled: canViewBoardDocuments,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, category, file_path, uploaded_by, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const documents = documentsQuery.data ?? [];

  // CEO Office reads the same visitor records maintained by the Secretary Office.
  const visitorLogsQuery = useQuery({
    queryKey: ["ceo-office-visitor-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("secretary_visitors")
        .select("id, visitor_name, organization, purpose, person_to_visit, arrived_at, departed_at, notes")
        .order("arrived_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });
  const visitorLogs = visitorLogsQuery.data ?? [];
  const visitorsOnSite = visitorLogs.filter((visitor) => !visitor.departed_at).length;

  const uploadDocumentMutation = useMutation({
    mutationFn: async (input: { file: File; title: string; category: string }) => {
      if (!canUploadBoardDocuments) {
        throw new Error("You do not have permission to upload documents.");
      }
      if (input.file.size > 20 * 1024 * 1024) {
        throw new Error("Files must be 20 MB or smaller.");
      }
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Please sign in before uploading a document.");

      const safeName = input.file.name
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/^_+|_+$/g, "") || "document";
      const filePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: storageError } = await supabase.storage
        .from("board-documents")
        .upload(filePath, input.file, {
          cacheControl: "3600",
          contentType: input.file.type || "application/octet-stream",
          upsert: false,
        });
      if (storageError) throw storageError;

      const { error: metadataError } = await supabase.from("documents").insert({
        title: input.title,
        category: input.category,
        file_path: filePath,
        uploaded_by: user.id,
      });
      if (metadataError) {
        await supabase.storage.from("board-documents").remove([filePath]);
        throw metadataError;
      }
      return { title: input.title };
    },
    onSuccess: async () => {
      setSelectedDocument(null);
      setDocumentTitle("");
      setDocumentCategory("Meeting minutes");
      if (documentFileInputRef.current) documentFileInputRef.current.value = "";
      if (canViewBoardDocuments) {
        await queryClient.invalidateQueries({ queryKey: ["board-documents-library"] });
      }
    },
  });

  const downloadDocumentMutation = useMutation({
    mutationFn: async (document: {
      id: string;
      title: string;
      category: string | null;
      file_path: string | null;
      uploaded_by: string | null;
      created_at: string;
    }) => {
      if (!canViewBoardDocuments) {
        throw new Error("Only the CEO and Administrator can download board documents.");
      }
      if (!document.file_path) throw new Error("This record has no stored file path.");
      const { data, error } = await supabase.storage
        .from("board-documents")
        .download(document.file_path);
      if (error) throw error;

      const objectUrl = URL.createObjectURL(data);
      const anchor = window.document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = document.file_path.split("/").pop() || document.title;
      anchor.rel = "noopener";
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    },
  });

  const decisionMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "approved" | "rejected";
    }) => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in first.");

      const { error } = await supabase
        .from("executive_approvals")
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "pending");

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["ceo-executive-approvals"],
      });
    },
  });

  
  const paymentMutation = useMutation({
    mutationFn: async ({
      id,
      spentOn,
      reference,
      category,
    }: {
      id: string;
      spentOn: string;
      reference: string;
      category: string;
    }) => {
      const { data, error } = await supabase.rpc(
        "record_approved_purchase_as_paid",
        {
          p_approval_id: id,
          p_spent_on: spentOn,
          p_reference: reference.trim() || null,
          p_category: category.trim(),
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["ceo-executive-approvals"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["ceo-office-live-data"],
        }),
      ]);
    },
  });

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
  <div className="mb-4">
    <h3 className="font-semibold">Executive decision centre</h3>
    <p className="mt-1 text-sm text-muted-foreground">
      Review requests and record executive decisions.
    </p>
  </div>

  {approvalsQuery.isLoading ? (
    <p className="text-sm text-muted-foreground">
      Loading approval requests...
    </p>
  ) : approvalsQuery.isError ? (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-destructive">
        Could not load approval requests.
      </p>
      <button
        type="button"
        onClick={() => void approvalsQuery.refetch()}
        className="mt-2 rounded-lg border px-3 py-2 text-sm"
      >
        Try again
      </button>
    </div>
  ) : approvals.length === 0 ? (
    <div className="rounded-xl border border-dashed p-6 text-center">
      <h4 className="font-semibold">No approval requests yet</h4>
      <p className="mt-2 text-sm text-muted-foreground">
        Requests submitted by staff will appear here when they are
        available to your account.
      </p>
    </div>
  ) : (
    <div className="space-y-4">
      {approvals.map((approval) => (
        <div key={approval.id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold">{approval.title}</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Submitted{" "}
                {new Date(approval.created_at).toLocaleString()}
              </p>
            </div>
            <span className="rounded-full border px-3 py-1 text-xs font-medium capitalize">
              {approval.status}
            </span>
          </div>


                        {approval.request_details && (
            <p className="mt-3 whitespace-pre-wrap text-sm">
              {approval.request_details}
            </p>
          )}

          {approval.amount != null && (
            <p className="mt-2 text-sm font-semibold">
              Amount: {money(amount(approval.amount))}
            </p>
          )}

          {approval.decision_notes && (
            <p className="mt-2 text-sm text-muted-foreground">
              Decision notes: {approval.decision_notes}
            </p>
          )}
          
          {approval.status === "pending" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={decisionMutation.isPending}
                onClick={() =>
                  decisionMutation.mutate({
                    id: approval.id,
                    status: "approved",
                  })
                }
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Approve
              </button>

              <button
                type="button"
                disabled={decisionMutation.isPending}
                onClick={() =>
                  decisionMutation.mutate({
                    id: approval.id,
                    status: "rejected",
                  })
                }
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          )}
          
          {approval.status === "approved" &&
            approval.payment_status !== "paid" &&
            !approval.expense_id && (
              <button
                type="button"
                disabled={paymentMutation.isPending}
                onClick={() => {
                  const spentOn = window.prompt(
                    "Enter the date the purchase was paid (YYYY-MM-DD):",
                    new Date().toISOString().slice(0, 10)
                  );
                  if (!spentOn) return;

                  const category = window.prompt(
                    "Enter the expense category:",
                    "Other expenses"
                  );
                  if (!category?.trim()) return;

                  const reference = window.prompt(
                    "Enter payment reference (optional):",
                    ""
                  );
                  if (reference === null) return;

                  if (
                    window.confirm(
                      `Record ₦${Number(approval.amount).toLocaleString()} as PAID on ${spentOn}? This will create the actual expense.`
                    )
                  ) {
                    paymentMutation.mutate({
                      id: approval.id,
                      spentOn,
                      reference,
                      category,
                    });
                  }
                }}
                className="mt-4 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {paymentMutation.isPending
                  ? "Recording payment..."
                  : "Record purchase as paid"}
              </button>
            )}

          {approval.payment_status === "paid" && (
            <p className="mt-3 text-sm font-medium text-green-700">
              Purchase recorded as paid.
            </p>
          )}
        </div>
      ))}
    </div>
  )}

  {decisionMutation.isError && (
    <p className="mt-4 text-sm text-destructive">
      The decision could not be saved. Check your permissions and try
      again.
    </p>
  )}
</Panel>

          
          <Panel title="Strategic Reports" className="mt-6">
            <div className="mb-4">
              <h3 className="font-semibold">
                Farm performance report
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Executive summary generated from the current dashboard data.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Livestock population
                </p>
                <p className="mt-2 text-xl font-bold">
                  {data ? data.livestockCount.toLocaleString() : "—"}
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Livestock valuation
                </p>
                <p className="mt-2 text-xl font-bold">
                  {data ? money(data.livestockValue) : "—"}
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Sales this month
                </p>
                <p className="mt-2 text-xl font-bold">
                  {data ? money(data.monthlySales) : "—"}
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Other income this month
                </p>
                <p className="mt-2 text-xl font-bold">
                  {data ? money(data.monthlyIncome) : "—"}
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Expenses this month
                </p>
                <p className="mt-2 text-xl font-bold">
                  {data ? money(data.monthlyExpenses) : "—"}
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Estimated monthly surplus
                </p>
                <p className="mt-2 text-xl font-bold">
                  {data ? money(data.estimatedProfit) : "—"}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-lg border p-4">
              <h4 className="font-semibold">Executive assessment</h4>
              <p className="mt-2 text-sm text-muted-foreground">
                {data
                  ? `The farm currently records ${data.livestockCount.toLocaleString()} livestock, with an estimated livestock value of ${money(data.livestockValue)}. Monthly sales and other income total ${money(data.monthlySales + data.monthlyIncome)}, against expenses of ${money(data.monthlyExpenses)}. The estimated surplus is ${money(data.estimatedProfit)}. ${data.lowStock.length > 0 ? `${data.lowStock.length} inventory item(s) require a stock-level review.` : "No inventory items currently meet the low-stock threshold."}`
                  : "Report figures will appear when dashboard data is available."}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Print / Save as PDF
              </button>
            </div>
          </Panel>
          
          
<Panel title="Business Targets" className="mt-6">
  <div className="mb-4">
    <h3 className="font-semibold">Strategic performance targets</h3>
    <p className="mt-1 text-sm text-muted-foreground">
      Save management goals and review them against actual farm performance.
    </p>
  </div>

  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {[
      {
        title: "Livestock population",
        value: data?.livestockCount.toLocaleString() ?? "—",
      },
      {
        title: "Monthly sales",
        value: data ? money(data.monthlySales) : "—",
      },
      {
        title: "Monthly income",
        value: data ? money(data.monthlySales + data.monthlyIncome) : "—",
      },
      {
        title: "Monthly expenses",
        value: data ? money(data.monthlyExpenses) : "—",
      },
    ].map((item) => (
      <div key={item.title} className="rounded-lg border p-4">
        <p className="text-sm font-medium">{item.title}</p>
        <p className="mt-2 text-xl font-bold">{item.value}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Current position
        </p>
      </div>
    ))}
  </div>

  <div className="mt-5 rounded-xl border p-5">
    <h4 className="font-semibold">Configure a business target</h4>

    <form
      className="mt-4 grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);

        targetMutation.mutate(
          {
            title: String(formData.get("title") ?? "").trim(),
            metric: String(formData.get("metric") ?? ""),
            target_value: Number(formData.get("target_value")),
            period_start: String(formData.get("period_start") ?? ""),
            period_end: String(formData.get("period_end") ?? ""),
            notes: String(formData.get("notes") ?? "").trim() || null,
          },
          {
            onSuccess: () => form.reset(),
          }
        );
      }}
    >
      <label className="text-sm">
        Target name
        <input
          name="title"
          required
          maxLength={120}
          placeholder="e.g. October sales target"
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
        />
      </label>

      <label className="text-sm">
        Metric
        <select
          name="metric"
          required
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
          defaultValue="monthly_sales"
        >
          <option value="livestock_population">Livestock population</option>
          <option value="monthly_sales">Monthly sales</option>
          <option value="monthly_income">Monthly income</option>
          <option value="monthly_expenses">Monthly expenses budget</option>
        </select>
      </label>

      <label className="text-sm">
        Target value
        <input
          name="target_value"
          type="number"
          min="0"
          step="0.01"
          required
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
        />
      </label>

      <label className="text-sm">
        Period starts
        <input
          name="period_start"
          type="date"
          required
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
        />
      </label>

      <label className="text-sm">
        Period ends
        <input
          name="period_end"
          type="date"
          required
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
        />
      </label>

      <label className="text-sm">
        Notes (optional)
        <input
          name="notes"
          maxLength={500}
          placeholder="Additional details"
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
        />
      </label>

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={targetMutation.isPending}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {targetMutation.isPending ? "Saving..." : "Save target"}
        </button>
      </div>
    </form>

    {targetMutation.isError && (
      <p className="mt-3 text-sm text-destructive">
        Could not save the target. Check your account permissions and ensure
        the end date is not before the start date.
      </p>
    )}

    {targetMutation.isSuccess && (
      <p className="mt-3 text-sm">
        Target saved successfully.
      </p>
    )}
  </div>

  <div className="mt-6">
    <h4 className="font-semibold">Saved targets</h4>

    {targetsQuery.isLoading ? (
      <p className="mt-3 text-sm text-muted-foreground">Loading targets...</p>
    ) : targetsQuery.isError ? (
      <p className="mt-3 text-sm text-destructive">
        Could not load saved targets. Check your database permissions.
      </p>
    ) : targetsQuery.data.length === 0 ? (
      <p className="mt-3 text-sm text-muted-foreground">
        No targets saved yet. Use the form above to add your first target.
      </p>
    ) : (
      <div className="mt-3 space-y-3">
        {targetsQuery.data.map((target) => (
          <div key={target.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <h5 className="font-medium">{target.title}</h5>
              <span className="text-sm font-semibold">
                {target.metric === "livestock_population"
                  ? Number(target.target_value).toLocaleString()
                  : money(Number(target.target_value))}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {target.metric.replaceAll("_", " ")} · {target.period_start} to{" "}
              {target.period_end}
            </p>
            {target.notes && (
              <p className="mt-2 text-sm">{target.notes}</p>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
</Panel>

          
          <Panel title="Visitor Logs" className="mt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Secretary Office visitor register</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Read-only view of visitor records entered by the Secretary Office. Updates refresh automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void visitorLogsQuery.refetch()}
                disabled={visitorLogsQuery.isFetching}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${visitorLogsQuery.isFetching ? "animate-spin" : ""}`} />
                Refresh visitors
              </button>
            </div>

            <div className="mb-4 flex items-center gap-3 rounded-lg border p-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Visitors currently on site</p>
                <p className="text-xl font-semibold">{visitorsOnSite}</p>
              </div>
            </div>

            {visitorLogsQuery.isPending ? (
              <p className="text-sm text-muted-foreground">Loading visitor records...</p>
            ) : visitorLogsQuery.isError ? (
              <div className="rounded-lg border border-destructive/40 p-4">
                <p role="alert" className="text-sm text-destructive">
                  Could not load visitor logs: {visitorLogsQuery.error.message}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Confirm that the Secretary Office database migration is applied and CEO/Administrator read access is enabled.
                </p>
              </div>
            ) : visitorLogs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 font-medium">No visitors recorded yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Visitors registered in the Secretary Office will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visitorLogs.map((visitor) => (
                  <article key={visitor.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-semibold">{visitor.visitor_name}</h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {visitor.organization || "No organization"} · Arrived {new Date(visitor.arrived_at).toLocaleString()}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${visitor.departed_at ? "bg-muted text-muted-foreground" : "bg-green-500/10 text-green-700 dark:text-green-400"}`}>
                        {visitor.departed_at ? "Checked out" : "On site"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm"><strong>Purpose:</strong> {visitor.purpose}</p>
                    <p className="mt-1 text-sm"><strong>Meeting with:</strong> {visitor.person_to_visit || "Not specified"}</p>
                    {visitor.departed_at && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Checked out: {new Date(visitor.departed_at).toLocaleString()}
                      </p>
                    )}
                    {visitor.notes && <p className="mt-2 text-sm text-muted-foreground"><strong>Notes:</strong> {visitor.notes}</p>}
                  </article>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Board Documents" className="mt-6">
            <div className="mb-4">
              <h3 className="font-semibold">
                Board and governance records
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                A central place for board meeting minutes, resolutions,
                strategic plans, and executive documents.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  title: "Meeting minutes",
                  description: "Records of board and management meetings.",
                },
                {
                  title: "Board resolutions",
                  description: "Formal decisions and approved actions.",
                },
                {
                  title: "Strategic plans",
                  description: "Business plans and long-term objectives.",
                },
                {
                  title: "Financial reports",
                  description: "Reports prepared for executive review.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border p-4"
                >
                  <h4 className="font-semibold">{item.title}</h4>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-5">
              {canUploadBoardDocuments ? (
                <form
                  className="rounded-xl border p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!selectedDocument || !documentTitle.trim()) return;
                    uploadDocumentMutation.mutate({
                      file: selectedDocument,
                      title: documentTitle.trim(),
                      category: documentCategory,
                    });
                  }}
                >
                  <div className="mb-4 flex items-start gap-3">
                    <Upload className="mt-1 h-5 w-5 text-primary" />
                    <div>
                      <h4 className="font-semibold">Upload a board document</h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Files are stored in the private board-documents bucket. Maximum file size: 20 MB.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium">
                      Document title
                      <input
                        value={documentTitle}
                        onChange={(event) => setDocumentTitle(event.target.value)}
                        required
                        maxLength={160}
                        placeholder="e.g. Board meeting minutes — October"
                        className="mt-1 block w-full rounded-lg border bg-background px-3 py-2 font-normal"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Category
                      <select
                        value={documentCategory}
                        onChange={(event) => setDocumentCategory(event.target.value)}
                        className="mt-1 block w-full rounded-lg border bg-background px-3 py-2 font-normal"
                      >
                        <option value="Meeting minutes">Meeting minutes</option>
                        <option value="Board resolutions">Board resolutions</option>
                        <option value="Strategic plans">Strategic plans</option>
                        <option value="Financial reports">Financial reports</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>
                  </div>
                  <label className="mt-3 block text-sm font-medium">
                    Choose file
                    <input
                      ref={documentFileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg"
                      required
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setSelectedDocument(file);
                        if (file && !documentTitle.trim()) {
                          setDocumentTitle(file.name.replace(/\.[^.]+$/, ""));
                        }
                      }}
                      className="mt-1 block w-full rounded-lg border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  {selectedDocument && selectedDocument.size > 20 * 1024 * 1024 ? (
                    <p className="mt-2 text-sm text-destructive">This file is larger than 20 MB. Please choose a smaller file.</p>
                  ) : null}
                  {uploadDocumentMutation.isError ? (
                    <p role="alert" className="mt-3 text-sm text-destructive">
                      Upload failed: {uploadDocumentMutation.error.message}
                    </p>
                  ) : null}
                  {uploadDocumentMutation.isSuccess ? (
                    <p role="status" className="mt-3 text-sm text-primary">
                      Document uploaded successfully.
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={
                      !selectedDocument ||
                      !documentTitle.trim() ||
                      selectedDocument.size > 20 * 1024 * 1024 ||
                      uploadDocumentMutation.isPending
                    }
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    {uploadDocumentMutation.isPending ? "Uploading..." : "Upload document"}
                  </button>
                </form>
              ) : (
                <div className="rounded-xl border border-dashed p-4">
                  <p className="text-sm text-muted-foreground">
                    You do not have permission to upload documents. Contact an administrator if you need access.
                  </p>
                </div>
              )}

              {canViewBoardDocuments ? (
                <div className="rounded-xl border p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">Board document library</h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Only the CEO and Administrator can view and download these records.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void documentsQuery.refetch()}
                      className="inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </button>
                  </div>

                  {documentsQuery.isPending ? (
                    <p className="text-sm text-muted-foreground">Loading documents...</p>
                  ) : documentsQuery.isError ? (
                    <div>
                      <p role="alert" className="text-sm text-destructive">
                        Could not load the document library: {documentsQuery.error.message}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Check the documents table policy and private bucket permissions.
                      </p>
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 font-medium">No documents uploaded yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Uploaded board records will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {documents.map((document) => (
                        <div
                          key={document.id}
                          className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <FileText className="mt-1 h-5 w-5 shrink-0 text-primary" />
                            <div className="min-w-0">
                              <p className="break-words font-medium">{document.title}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {document.category || "Uncategorized"} ·{" "}
                                {new Date(document.created_at).toLocaleString()}
                              </p>
                              <p className="mt-1 break-all text-xs text-muted-foreground">
                                {document.file_path?.split("/").pop() || "File path unavailable"}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={!document.file_path || downloadDocumentMutation.isPending}
                            onClick={() => downloadDocumentMutation.mutate(document)}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {downloadDocumentMutation.isError ? (
                    <p role="alert" className="mt-3 text-sm text-destructive">
                      Download failed: {downloadDocumentMutation.error.message}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-4">
                  <h4 className="font-semibold">Document access is restricted</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You may upload a document if you have upload permission, but only the CEO and Administrator can view or download board documents.
                  </p>
                </div>
              )}
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
