import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/app/PageKit";

type PendingRow = { id: string; label: string; detail: string; table: "animals" | "animal_batches" | "inventory_items" };

export function PendingApprovalsPanel() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const canApprove = hasRole("ceo") || hasRole("administrator");
  const query = useQuery({
    queryKey: ["record-approvals-pending"],
    enabled: canApprove,
    queryFn: async (): Promise<PendingRow[]> => {
      const db = supabase as any;
      const [a, b, i] = await Promise.all([
        db.from("animals").select("id,tag_number,created_at").eq("approval_status", "pending").order("created_at", { ascending: false }),
        db.from("animal_batches").select("id,batch_code,initial_quantity,created_at").eq("approval_status", "pending").order("created_at", { ascending: false }),
        db.from("inventory_items").select("id,name,unit,submitted_quantity,created_at").eq("approval_status", "pending").order("created_at", { ascending: false }),
      ]);
      for (const result of [a, b, i]) if (result.error) throw result.error;
      return [
        ...(a.data ?? []).map((x: any) => ({ id: x.id, label: x.tag_number, detail: "Individual livestock", table: "animals" as const })),
        ...(b.data ?? []).map((x: any) => ({ id: x.id, label: x.batch_code, detail: `Batch · ${x.initial_quantity} submitted`, table: "animal_batches" as const })),
        ...(i.data ?? []).map((x: any) => ({ id: x.id, label: x.name, detail: `Inventory · ${x.submitted_quantity ?? 0} ${x.unit}`, table: "inventory_items" as const })),
      ];
    },
  });

  async function decide(row: PendingRow, decision: "approved" | "rejected") {
    if (!canApprove || !user) return;
    const db = supabase as any;
    const { error } = await db.from(row.table).update({
      approval_status: decision,
      rejection_reason: decision === "rejected" ? "Rejected by CEO/Administrator" : null,
      approved_by: decision === "approved" ? user.id : null,
      approved_at: decision === "approved" ? new Date().toISOString() : null,
    }).eq("id", row.id).eq("approval_status", "pending");
    if (error) { toast.error(error.message); return; }
    toast.success(decision === "approved" ? "Record approved and included in totals" : "Record rejected");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["record-approvals-pending"] }),
      qc.invalidateQueries({ queryKey: ["dashboard-live-data"] }),
      qc.invalidateQueries({ queryKey: ["livestock"] }),
      qc.invalidateQueries({ queryKey: ["inventory-items"] }),
    ]);
  }

  if (!canApprove) return null;
  return <Panel title="Pending approvals" action={<span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Clock3 className="h-4 w-4" />{query.data?.length ?? 0} waiting</span>}>
    {query.isError ? <p className="text-sm text-destructive">Could not load approvals: {(query.error as Error).message}</p> :
      query.isLoading ? <p className="text-sm text-muted-foreground">Loading pending records…</p> :
      !query.data?.length ? <p className="text-sm text-muted-foreground">There are no records waiting for approval.</p> :
      <div className="space-y-3">{query.data.map(row => <div key={row.table + row.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="font-semibold">{row.label}</p><p className="text-sm text-muted-foreground">{row.detail} · {row.table.replace("_", " ")}</p></div>
        <div className="flex shrink-0 gap-2"><Button size="sm" onClick={() => void decide(row, "approved")}><CheckCircle2 className="mr-1 h-4 w-4" />Approve</Button><Button size="sm" variant="outline" onClick={() => void decide(row, "rejected")}><XCircle className="mr-1 h-4 w-4" />Reject</Button></div>
      </div>)}</div>}
  </Panel>;
}
