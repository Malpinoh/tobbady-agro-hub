import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/app/PageKit";
import { ChangeComparison, RecordFields, useApprovalLookups } from "@/components/app/ApprovalDetails";

type RecordTable = "animals" | "animal_batches" | "inventory_items";
type RecordValues = Record<string, unknown>;
type PendingRow =
  | {
      kind: "new-record";
      id: string;
      label: string;
      detail: string;
      table: RecordTable;
      values: RecordValues;
    }
  | {
      kind: "change-request";
      id: string;
      label: string;
      detail: string;
      recordType: "animal" | "batch";
      requestType: "edit" | "delete";
      reason: string;
      requestedBy: string;
      proposed: unknown;
      original: unknown;
    };

export function PendingApprovalsPanel() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const canApprove = hasRole("ceo") || hasRole("administrator");

  const lookups = useApprovalLookups(canApprove).data;

  const query = useQuery({
    queryKey: ["record-approvals-pending"],
    enabled: canApprove,
    queryFn: async (): Promise<PendingRow[]> => {
      const db = supabase as any;
      const [a, b, i, requests] = await Promise.all([
        db.from("animals").select("*").eq("approval_status", "pending").order("created_at", { ascending: false }),
        db.from("animal_batches").select("*").eq("approval_status", "pending").order("created_at", { ascending: false }),
        db.from("inventory_items").select("*").eq("approval_status", "pending").order("created_at", { ascending: false }),
        db.from("record_change_requests").select("*").eq("status", "pending").order("requested_at", { ascending: false }),
      ]);
      for (const result of [a, b, i, requests]) {
        if (result.error) throw result.error;
      }

      return [
        ...(a.data ?? []).map((x: RecordValues) => ({
          kind: "new-record" as const,
          id: String(x["id"]),
          label: String(x["tag_number"] ?? "Untitled animal"),
          detail: "New individual livestock record · review all submitted fields",
          table: "animals" as const,
          values: x,
        })),
        ...(b.data ?? []).map((x: RecordValues) => ({
          kind: "new-record" as const,
          id: String(x["id"]),
          label: String(x["batch_code"] ?? "Untitled batch"),
          detail: `New livestock batch · ${String(x["initial_quantity"] ?? 0)} submitted · review all submitted fields`,
          table: "animal_batches" as const,
          values: x,
        })),
        ...(i.data ?? []).map((x: RecordValues) => ({
          kind: "new-record" as const,
          id: String(x["id"]),
          label: String(x["name"] ?? "Untitled inventory item"),
          detail: `New inventory item · ${String(x["submitted_quantity"] ?? 0)} ${String(x["unit"] ?? "")} · review all submitted fields`,
          table: "inventory_items" as const,
          values: x,
        })),
        ...(requests.data ?? []).map((x: RecordValues) => ({
          kind: "change-request" as const,
          id: String(x["id"]),
          label: String(x["record_label"] ?? "Livestock change request"),
          detail: `${x["request_type"] === "delete" ? "Deletion" : "Edit"} request · ${x["record_type"] === "animal" ? "Individual livestock" : "Livestock batch"}`,
          recordType: x["record_type"] as "animal" | "batch",
          requestType: x["request_type"] as "edit" | "delete",
          reason: String(x["reason"] ?? "No reason supplied"),
          requestedBy: String(x["requested_by"] ?? "Unknown user"),
          proposed: x["proposed_values"],
          original: x["original_values"],
        })),
      ];
    },
  });

  async function decide(row: PendingRow, decision: "approved" | "rejected") {
    if (!canApprove || !user) return;
    const db = supabase as any;
    let error: { message: string } | null = null;

    if (row.kind === "change-request") {
      const rejectionReason = decision === "rejected"
        ? (window.prompt("Reason for rejecting this request?")?.trim() || "")
        : null;
      if (decision === "rejected" && !rejectionReason) {
        toast.error("Enter a reason to reject this request.");
        return;
      }
      const result = await db.rpc("review_record_change_request", {
        p_request_id: row.id,
        p_decision: decision,
        p_rejection_reason: rejectionReason,
      });
      error = result.error;
    } else {
      const result = await db
        .from(row.table)
        .update({
          approval_status: decision,
          rejection_reason: decision === "rejected" ? "Rejected by CEO/Administrator" : null,
          approved_by: decision === "approved" ? user.id : null,
          approved_at: decision === "approved" ? new Date().toISOString() : null,
        })
        .eq("id", row.id)
        .eq("approval_status", "pending");
      error = result.error;
    }

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(decision === "approved" ? "Request approved" : "Request rejected");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["record-approvals-pending"] }),
      qc.invalidateQueries({ queryKey: ["dashboard-live-data"] }),
      qc.invalidateQueries({ queryKey: ["livestock"] }),
      qc.invalidateQueries({ queryKey: ["inventory-items"] }),
      qc.invalidateQueries({ queryKey: ["reports-animals"] }),
      qc.invalidateQueries({ queryKey: ["reports-batches"] }),
    ]);
  }

  if (!canApprove) return null;

  return (
    <Panel
      title="Pending approvals"
      action={
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <Clock3 className="h-4 w-4" />
          {query.data?.length ?? 0} waiting
        </span>
      }
    >
      {query.isError ? (
        <p className="text-sm text-destructive">Could not load approvals: {(query.error as Error).message}</p>
      ) : query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading pending records…</p>
      ) : !query.data?.length ? (
        <p className="text-sm text-muted-foreground">There are no records waiting for approval.</p>
      ) : (
        <div className="space-y-4">
          {query.data.map((row) => (
            <div key={row.kind + row.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{row.label}</p>
                  <p className="text-sm text-muted-foreground">{row.detail}</p>
                  {row.kind === "change-request" && (
                    <>
                      <p className="mt-2 text-sm">
                        <strong>Secretary's reason:</strong> {row.reason}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <strong>Requested by:</strong> {lookups?.user.get(row.requestedBy) ?? "Staff member"}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => void decide(row, "approved")}>
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void decide(row, "rejected")}>
                    <XCircle className="mr-1 h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>

              {row.kind === "new-record" ? (
                <details>
                  <summary className="cursor-pointer text-sm font-medium">View full details before deciding</summary>
                  <div className="mt-3">
                    <RecordFields values={row.values} lookups={lookups} />
                  </div>
                </details>
              ) : (
                <details open>
                  <summary className="cursor-pointer text-sm font-medium">
                    Inspect {row.requestType === "delete" ? "record to be deleted" : "current and proposed changes"} before decision
                  </summary>
                  <div className="mt-3">
                    {row.requestType === "delete" ? (
                      <>
                        <p className="mb-2 text-sm font-medium text-destructive">This record will be deleted if approved:</p>
                        <RecordFields values={row.original} lookups={lookups} />
                      </>
                    ) : (
                      <ChangeComparison original={row.original} proposed={row.proposed} lookups={lookups} />
                    )}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
