import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Eye, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      genericDelete?: boolean;
    };

export function PendingApprovalsPanel() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const canApprove = hasRole("ceo") || hasRole("administrator");
  const [selectedRow, setSelectedRow] = useState<PendingRow | null>(null);
  const [isDeciding, setIsDeciding] = useState(false);

  const lookups = useApprovalLookups(canApprove).data;

  const query = useQuery({
    queryKey: ["record-approvals-pending"],
    enabled: canApprove,
    queryFn: async (): Promise<PendingRow[]> => {
      const db = supabase as any;
      const [a, b, i, requests, deleteRequests] = await Promise.all([
        db.from("animals").select("*").eq("approval_status", "pending").order("created_at", { ascending: false }),
        db.from("animal_batches").select("*").eq("approval_status", "pending").order("created_at", { ascending: false }),
        db.from("inventory_items").select("*").eq("approval_status", "pending").order("created_at", { ascending: false }),
        db.from("record_change_requests").select("*").eq("status", "pending").order("requested_at", { ascending: false }),
        db.from("secretary_delete_requests").select("*").eq("status", "pending").order("requested_at", { ascending: false }),
      ]);
      for (const result of [a, b, i, requests, deleteRequests]) {
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
        ...(deleteRequests.data ?? []).map((x: RecordValues) => ({
          kind: "change-request" as const,
          id: String(x["id"]),
          label: String(x["record_label"] ?? "Deletion request"),
          detail: `Delete request · ${String(x["table_name"] ?? "business record").replaceAll("_", " ")}`,
          recordType: "animal" as const,
          requestType: "delete" as const,
          reason: String(x["reason"] ?? "Deletion requested from the record page"),
          requestedBy: String(x["requested_by"] ?? "Unknown user"),
          proposed: null,
          original: x["record_snapshot"],
          genericDelete: true,
        })),
      ];
    },
  });

  async function decide(row: PendingRow, decision: "approved" | "rejected") {
    if (!canApprove || !user || isDeciding) return;

    if (row.kind === "change-request" && decision === "rejected") {
      const rejectionReason = window.prompt("Reason for rejecting this request?")?.trim() || "";
      if (!rejectionReason) {
        toast.error("Enter a reason to reject this request.");
        return;
      }
      await submitDecision(row, decision, rejectionReason);
      return;
    }

    await submitDecision(row, decision, null);
  }

  async function submitDecision(
    row: PendingRow,
    decision: "approved" | "rejected",
    rejectionReason: string | null,
  ) {
    if (!canApprove || !user) return;
    setIsDeciding(true);
    const db = supabase as any;
    let error: { message: string } | null = null;

    try {
      if (row.kind === "change-request") {
        const result = row.genericDelete
          ? await db.rpc("review_secretary_delete_request", {
              p_request_id: row.id,
              p_decision: decision,
              p_rejection_reason: rejectionReason,
            })
          : await db.rpc("review_record_change_request", {
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
      setSelectedRow(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["record-approvals-pending"] }),
        qc.invalidateQueries({ queryKey: ["dashboard-live-data"] }),
        qc.invalidateQueries({ queryKey: ["livestock"] }),
        qc.invalidateQueries({ queryKey: ["inventory-items"] }),
        qc.invalidateQueries({ queryKey: ["reports-animals"] }),
        qc.invalidateQueries({ queryKey: ["reports-batches"] }),
      ]);
    } finally {
      setIsDeciding(false);
    }
  }

  if (!canApprove) return null;

  return (
    <>
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
                        <p className="mt-2 text-sm"><strong>Secretary's reason:</strong> {row.reason}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <strong>Requested by:</strong> {lookups?.user.get(row.requestedBy) ?? "Staff member"}
                        </p>
                      </>
                    )}
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => setSelectedRow(row)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Review full details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Dialog open={selectedRow !== null} onOpenChange={(open) => {
        if (!open && !isDeciding) setSelectedRow(null);
      }}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100%-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
          {selectedRow && (
            <>
              <DialogHeader className="border-b px-5 py-4 pr-12 text-left sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-xl">{selectedRow.label}</DialogTitle>
                  <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                    Pending approval
                  </span>
                </div>
                <DialogDescription>{selectedRow.detail}</DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                {selectedRow.kind === "new-record" ? (
                  <>
                    <div>
                      <h3 className="mb-3 text-sm font-semibold">Complete submitted record</h3>
                      <RecordFields values={selectedRow.values} lookups={lookups} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      All available submitted fields are shown above. Fields without a value appear as a dash; internal database identifiers are not displayed as raw technical codes.
                    </p>
                  </>
                ) : (
                  <>
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold">Request information</h3>
                      <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Request type</p>
                          <p className="mt-1 text-sm">{selectedRow.requestType === "delete" ? "Delete record" : "Edit record"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Requested by</p>
                          <p className="mt-1 text-sm">{lookups?.user.get(selectedRow.requestedBy) ?? "Staff member"}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reason provided</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{selectedRow.reason}</p>
                        </div>
                      </div>
                    </section>
                    {selectedRow.requestType === "delete" ? (
                      <section className="space-y-2">
                        <h3 className="text-sm font-semibold text-destructive">Complete record proposed for deletion</h3>
                        <RecordFields values={selectedRow.original} lookups={lookups} />
                      </section>
                    ) : (
                      <section className="space-y-2">
                        <h3 className="text-sm font-semibold">Current and proposed values</h3>
                        <ChangeComparison original={selectedRow.original} proposed={selectedRow.proposed} lookups={lookups} />
                      </section>
                    )}
                  </>
                )}
              </div>

              <DialogFooter className="gap-2 border-t bg-muted/20 px-5 py-4 sm:px-6">
                <Button variant="outline" onClick={() => setSelectedRow(null)} disabled={isDeciding}>
                  Close
                </Button>
                <Button variant="outline" onClick={() => void decide(selectedRow, "rejected")} disabled={isDeciding}>
                  <XCircle className="mr-2 h-4 w-4" />
                  {isDeciding ? "Processing…" : "Reject"}
                </Button>
                <Button onClick={() => void decide(selectedRow, "approved")} disabled={isDeciding}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {isDeciding ? "Processing…" : "Approve"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
