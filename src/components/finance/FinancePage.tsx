import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatNaira } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, RequirePermission } from "@/components/app/PageKit";

type IncomeRecord = {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  received_on: string;
  recorded_by: string | null;
  reference: string | null;
  status: string;
  created_at: string;
};

type ExpenseRecord = {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  spent_on: string;
  recorded_by: string | null;
  approved_by: string | null;
  reference: string | null;
  status: string;
  created_at: string;
};

const incomeCategories = [
  "Livestock sales",
  "Egg sales",
  "Fish sales",
  "Poultry sales",
  "Manure sales",
  "Other income",
];

const expenseCategories = [
  "Animal feed",
  "Veterinary care",
  "Vaccines and medicine",
  "Livestock purchase",
  "Staff salaries",
  "Transport",
  "Utilities",
  "Repairs and maintenance",
  "Equipment",
  "Other expenses",
];

function FinanceContent() {
  const { user, can } = useAuth();
  const queryClient = useQueryClient();

  const canManage = can("finance.manage");
  const canApprove = can("finance.approve") || can("settings.manage");

  const [search, setSearch] = useState("");
  const [recordType, setRecordType] = useState<"income" | "expense">("income");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewingStatus, setReviewingStatus] = useState<"approved" | "rejected" | null>(null);

  const [form, setForm] = useState({
    amount: "",
    category: "Livestock sales",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    reference: "",
  });

  const incomeQuery = useQuery({
    queryKey: ["finance-income"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income")
        .select("*")
        .order("received_on", { ascending: false });

      if (error) throw error;
      return (data ?? []) as IncomeRecord[];
    },
  });

  const expensesQuery = useQuery({
    queryKey: ["finance-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("spent_on", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ExpenseRecord[];
    },
  });

  const incomes = incomeQuery.data ?? [];
  const expenses = expensesQuery.data ?? [];

  const totalIncome = incomes
    .filter((record) => record.status === "received" || record.status === "approved")
    .reduce((sum, record) => sum + Number(record.amount), 0);

  const approvedExpenses = expenses
    .filter((record) => record.status === "approved")
    .reduce((sum, record) => sum + Number(record.amount), 0);

  const pendingExpenses = expenses.filter(
    (record) => record.status === "pending",
  );

  const netBalance = totalIncome - approvedExpenses;

  const combinedRecords = useMemo(() => {
    const incomeRows = incomes.map((record) => ({
      id: record.id,
      type: "income" as const,
      amount: Number(record.amount),
      category: record.category,
      description: record.description,
      date: record.received_on,
      reference: record.reference,
      status: record.status,
    }));

    const expenseRows = expenses.map((record) => ({
      id: record.id,
      type: "expense" as const,
      amount: Number(record.amount),
      category: record.category,
      description: record.description,
      date: record.spent_on,
      reference: record.reference,
      status: record.status,
    }));

    return [...incomeRows, ...expenseRows]
      .filter((record) => {
        const term = search.trim().toLowerCase();
        return (
          !term ||
          record.category.toLowerCase().includes(term) ||
          (record.description ?? "").toLowerCase().includes(term) ||
          (record.reference ?? "").toLowerCase().includes(term) ||
          record.type.includes(term) ||
          record.status.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [incomes, expenses, search]);

  function openRecord(type: "income" | "expense") {
    setRecordType(type);
    setForm({
      amount: "",
      category: type === "income" ? "Livestock sales" : "Animal feed",
      description: "",
      date: new Date().toISOString().slice(0, 10),
      reference: "",
    });
    setDialogOpen(true);
  }

  async function saveRecord() {
    if (!canManage) {
      alert("You do not have permission to record finance entries.");
      return;
    }

    const amount = Number(form.amount);

    if (!form.amount.trim() || !Number.isFinite(amount) || amount <= 0) {
      alert("Enter an amount greater than zero.");
      return;
    }

    if (!form.category || !form.date) {
      alert("Select a category and date.");
      return;
    }

    setSaving(true);

    try {
      if (recordType === "income") {
        const { error } = await supabase.from("income").insert({
          amount,
          category: form.category,
          description: form.description.trim() || null,
          received_on: form.date,
          reference: form.reference.trim() || null,
          recorded_by: user?.id ?? null,
          status: "received",
        });

        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert({
          amount,
          category: form.category,
          description: form.description.trim() || null,
          spent_on: form.date,
          reference: form.reference.trim() || null,
          recorded_by: user?.id ?? null,
          status: "pending",
        });

        if (error) throw error;
      }

      setDialogOpen(false);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance-income"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-expenses"] }),
      ]);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not save the finance record.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function reviewExpense(
    expense: ExpenseRecord,
    status: "approved" | "rejected",
  ) {
    if (!canApprove) {
      alert("You do not have permission to approve expenses.");
      return;
    }

    if (expense.status !== "pending") return;

    setReviewingId(expense.id);
    setReviewingStatus(status);

    try {
      const { error } = await supabase
        .from("expenses")
        .update({
          status,
          approved_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", expense.id)
        .eq("status", "pending");

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not update expense approval.",
      );
    } finally {
      setReviewingId(null);
      setReviewingStatus(null);
    }
  }

  const loading = incomeQuery.isLoading || expensesQuery.isLoading;
  const queryError = incomeQuery.isError || expensesQuery.isError;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Monitor farm income, expenses, approvals and cash flow."
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => openRecord("expense")}>
                <ArrowDownCircle className="mr-2 h-4 w-4" />
                Record expense
              </Button>
              <Button onClick={() => openRecord("income")}>
                <ArrowUpCircle className="mr-2 h-4 w-4" />
                Record income
              </Button>
            </div>
          ) : undefined
        }
      />

      {queryError && (
        <div className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
          Finance records could not be loaded. Check your connection and database permissions, then refresh the page.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm">Total income</span>
            <ArrowUpCircle className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-semibold">{formatNaira(totalIncome)}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Received or approved income
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm">Approved expenses</span>
            <ArrowDownCircle className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-semibold">
            {formatNaira(approvedExpenses)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Expenses approved for payment
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm">Net balance</span>
            <Wallet className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-semibold">{formatNaira(netBalance)}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Income minus approved expenses
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm">Pending approvals</span>
            <Clock className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-semibold">{pendingExpenses.length}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Expenses awaiting review
          </p>
        </div>
      </div>

      {pendingExpenses.length > 0 && (
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Clock className="h-5 w-5 text-amber-600" />
            Expenses awaiting approval
          </h2>

          <div className="space-y-3">
            {pendingExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex flex-col justify-between gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-medium">{expense.category}</p>
                  <p className="text-sm text-muted-foreground">
                    {expense.description || "No description"} · {new Date(expense.spent_on).toLocaleDateString()}
                  </p>
                  <p className="mt-1 font-semibold">{formatNaira(Number(expense.amount))}</p>
                </div>

                {canApprove && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={reviewingId === expense.id}
                      onClick={() => reviewExpense(expense, "approved")}
                    >
                      <CheckCircle className="mr-1 h-4 w-4" />
                      {reviewingId === expense.id && reviewingStatus === "approved"
                        ? "Approving..."
                        : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reviewingId === expense.id}
                      onClick={() => reviewExpense(expense, "rejected")}
                    >
                      <XCircle className="mr-1 h-4 w-4" />
                      {reviewingId === expense.id && reviewingStatus === "rejected"
                        ? "Rejecting..."
                        : "Reject"}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">Income and expense records</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All recorded finance entries, sorted by date.
          </p>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search category, description, reference or status..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Category / description</th>
                <th className="p-3 font-medium">Reference</th>
                <th className="p-3 font-medium">Amount</th>
                <th className="p-3 font-medium">Status</th>
                {canApprove && <th className="p-3 font-medium">Approval</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canApprove ? 7 : 6} className="p-8 text-center text-muted-foreground">
                    Loading finance records...
                  </td>
                </tr>
              ) : combinedRecords.length === 0 ? (
                <tr>
                  <td colSpan={canApprove ? 7 : 6} className="p-8 text-center">
                    <DollarSign className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="font-medium">No finance records found</p>
                    <p className="mt-1 text-muted-foreground">
                      Record income or expenses to start tracking your farm finances.
                    </p>
                  </td>
                </tr>
              ) : (
                combinedRecords.map((record) => {
                  const expense = record.type === "expense"
                    ? expenses.find((entry) => entry.id === record.id)
                    : undefined;

                  return (
                    <tr key={`${record.type}-${record.id}`} className="border-t">
                      <td className="whitespace-nowrap p-3">
                        {new Date(record.date).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1">
                          {record.type === "income" ? (
                            <ArrowUpCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                          {record.type}
                        </span>
                      </td>
                      <td className="p-3">
                        <p className="font-medium">{record.category}</p>
                        {record.description && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {record.description}
                          </p>
                        )}
                      </td>
                      <td className="p-3">{record.reference || "—"}</td>
                      <td className="whitespace-nowrap p-3 font-medium">
                        {formatNaira(record.amount)}
                      </td>
                      <td className="p-3">
                        <span className="rounded-full border px-2 py-1 text-xs capitalize">
                          {record.status}
                        </span>
                      </td>
                      {canApprove && (
                        <td className="p-3">
                          {expense?.status === "pending" ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                disabled={reviewingId === expense.id}
                                onClick={() => reviewExpense(expense, "approved")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={reviewingId === expense.id}
                                onClick={() => reviewExpense(expense, "rejected")}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {recordType === "income" ? "Record income" : "Record expense"}
            </DialogTitle>
            <DialogDescription>
              {recordType === "income"
                ? "Record money received by the farm."
                : "Submit a farm expense for approval."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (₦) *</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value })
                }
                placeholder="Enter amount in naira"
              />
            </div>

            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm({ ...form, category: value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(recordType === "income" ? incomeCategories : expenseCategories).map(
                    (category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm({ ...form, date: event.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Reference / receipt number</Label>
              <Input
                value={form.reference}
                onChange={(event) =>
                  setForm({ ...form, reference: event.target.value })
                }
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="Add details about this transaction..."
              />
            </div>

            {recordType === "expense" && (
              <p className="text-sm text-muted-foreground">
                New expenses will be marked as pending until an authorized user reviews them.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={saveRecord}>
              {saving ? "Saving..." : "Save record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FinancePage() {
  return (
    <RequirePermission perm="finance.view">
      <FinanceContent />
    </RequirePermission>
  );
}
