import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  BadgeDollarSign,
  History,
  Skull,
  Trash2,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { StatusBadge } from "@/components/app/PageKit";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

import {
  batchBreakdown,
  friendlyError,
  livestockKeys,
  movementsQuery,
  STATUS_TONE,
  titleCase,
  type Batch,
  type BatchWithMovements,
} from "@/lib/livestock";

import { Field, InfoRow, SectionPicker } from "./shared";
import type { Lookups, RefData } from "./types";

type Action = "mortality" | "sale" | "transfer" | null;

const fmt = (date: string | null) =>
  date ? format(new Date(date), "d MMM yyyy") : "—";

export function BatchDetailSheet({
  batch,
  onClose,
  refData,
  lk,
  canManage,
}: {
  batch: BatchWithMovements | null;
  onClose: () => void;
  refData: RefData;
  lk: Lookups;
  canManage: boolean;
}) {
  const [action, setAction] = useState<Action>(null);

  const breakdown = batch ? batchBreakdown(batch) : null;

  return (
    <>
      <Sheet
        open={!!batch}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {batch && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <SheetTitle className="font-display text-xl">
                    {batch.batch_code}
                  </SheetTitle>

                  <StatusBadge
                    tone={STATUS_TONE[batch.status] ?? "neutral"}
                  >
                    {titleCase(batch.status)}
                  </StatusBadge>
                </div>

                <SheetDescription>
                  {lk.typeName(batch.livestock_type_id)}
                  {" · "}
                  {lk.breedName(batch.breed_id)}
                </SheetDescription>
              </SheetHeader>

              {canManage && (
                <div className="mt-4"><DeletionRequestButton recordType="batch" recordId={batch.id} label={batch.batch_code} original={batch} /></div>
              )}
              {canManage && batch.current_quantity > 0 && (
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAction("mortality")}
                  >
                    <Skull className="mr-1.5 h-3.5 w-3.5" />
                    Mortality
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAction("sale")}
                  >
                    <BadgeDollarSign className="mr-1.5 h-3.5 w-3.5" />
                    Record sale
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAction("transfer")}
                  >
                    <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                    Transfer
                  </Button>
                </div>
              )}

              <div className="mt-6 space-y-6 px-1">
                <Section title="Quantity">
                  <InfoRow label="Initial quantity">
                    {batch.initial_quantity.toLocaleString()}
                  </InfoRow>

                  <InfoRow label="Current quantity">
                    <span className="text-primary">
                      {batch.current_quantity.toLocaleString()}
                    </span>
                  </InfoRow>

                  <InfoRow label="Mortality">
                    <span className="text-destructive">
                      {breakdown?.mortality.toLocaleString() ?? "0"}
                    </span>
                  </InfoRow>

                  <InfoRow label="Sold">
                    {breakdown?.sold.toLocaleString() ?? "0"}
                  </InfoRow>

                  <InfoRow label="Transferred">
                    {breakdown?.transferred.toLocaleString() ?? "0"}
                  </InfoRow>
                </Section>

                <Section title="Batch information">
                  <InfoRow label="Batch code">
                    {batch.batch_code}
                  </InfoRow>

                  <InfoRow label="Livestock type">
                    {lk.typeName(batch.livestock_type_id)}
                  </InfoRow>

                  <InfoRow label="Breed">
                    {lk.breedName(batch.breed_id)}
                  </InfoRow>

                  <InfoRow label="Started">
                    {fmt(batch.started_on)}
                  </InfoRow>

                  <InfoRow label="Farm">
                    {lk.farmName(batch.farm_section_id)}
                  </InfoRow>

                  <InfoRow label="Section">
                    {lk.sectionName(batch.farm_section_id)}
                  </InfoRow>

                  <InfoRow label="Status">
                    <StatusBadge
                      tone={STATUS_TONE[batch.status] ?? "neutral"}
                    >
                      {titleCase(batch.status)}
                    </StatusBadge>
                  </InfoRow>
                </Section>

                <Section title="Financial">
                  <InfoRow label="Acquisition cost">
                    {batch.acquisition_cost != null
                      ? `₦${Number(batch.acquisition_cost).toLocaleString(
                          "en-NG",
                        )}`
                      : "—"}
                  </InfoRow>

                  <InfoRow label="Estimated value / bird">
                    {batch.estimated_unit_value != null
                      ? `₦${Number(
                          batch.estimated_unit_value,
                        ).toLocaleString("en-NG")}`
                      : "—"}
                  </InfoRow>

                  <InfoRow label="Estimated current value">
                    {batch.estimated_unit_value != null
                      ? `₦${(
                          batch.current_quantity *
                          Number(batch.estimated_unit_value)
                        ).toLocaleString("en-NG")}`
                      : "—"}
                  </InfoRow>
                </Section>

                <Section title="Notes">
                  <p className="whitespace-pre-wrap py-2 text-sm">
                    {batch.notes || "No notes recorded."}
                  </p>
                </Section>

                <MovementHistory
                  batchId={batch.id}
                  lk={lk}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {batch && (
        <BatchActionDialog
          batch={batch}
          action={action}
          onClose={() => setAction(null)}
          refData={refData}
          lk={lk}
        />
      )}
    </>
  );
}

function MovementHistory({
  batchId,
  lk,
}: {
  batchId: string;
  lk: Lookups;
}) {
  const movements = useQuery(movementsQuery(batchId));

  return (
    <Section title="Movement history">
      {movements.isLoading ? (
        <div className="py-4 text-sm text-muted-foreground">
          Loading movement history…
        </div>
      ) : movements.error ? (
        <div className="py-4 text-sm text-destructive">
          Unable to load movement history.
        </div>
      ) : !movements.data?.length ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <History className="h-4 w-4" />
          No movements recorded yet.
        </div>
      ) : (
        <div className="divide-y">
          {movements.data.map((movement) => (
            <div
              key={movement.id}
              className="flex items-start justify-between gap-4 py-3"
            >
              <div>
                <div className="font-medium">
                  {titleCase(movement.movement_type)}
                </div>

                <div className="text-xs text-muted-foreground">
                  {fmt(movement.occurred_on)}
                </div>

                {movement.notes && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {movement.notes}
                  </div>
                )}

                {movement.to_section_id && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Destination:{" "}
                    {lk.sectionName(movement.to_section_id)}
                  </div>
                )}
              </div>

              <div className="font-semibold tabular">
                −{movement.quantity.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function BatchActionDialog({
  batch,
  action,
  onClose,
  refData,
  lk,
}: {
  batch: Batch;
  action: Action;
  onClose: () => void;
  refData: RefData;
  lk: Lookups;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [date, setDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [farmId, setFarmId] = useState(
    lk.farmIdOf(batch.farm_section_id),
  );
  const [sectionId, setSectionId] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const qty = Number(quantity);

      if (!Number.isInteger(qty) || qty <= 0) {
        throw new Error("Enter a valid whole-number quantity.");
      }

      if (qty > batch.current_quantity) {
        throw new Error(
          `Quantity cannot exceed the current batch quantity of ${batch.current_quantity}.`,
        );
      }

      if (action === "transfer" && !sectionId) {
        throw new Error("Choose the destination section.");
      }

      const movementType = action;

      if (!movementType) {
        throw new Error("No movement type selected.");
      }

      const { error } = await supabase
        .from("batch_movements")
        .insert({
          batch_id: batch.id,
          movement_type: movementType,
          quantity: qty,
          occurred_on: date,
          to_section_id:
            action === "transfer" && sectionId
              ? sectionId
              : null,
          notes: note.trim() || null,
          created_by: user?.id ?? null,
        });

      if (error) {
        throw new Error(error.message);
      }
    },

    onSuccess: () => {
      toast.success(
        action === "mortality"
          ? "Mortality recorded"
          : action === "sale"
            ? "Batch sale recorded"
            : "Batch transfer recorded",
      );

      void qc.invalidateQueries({
        queryKey: livestockKeys.all,
      });

      onClose();
      setQuantity("");
      setNote("");
      setSectionId("");
    },

    onError: (error) => {
      toast.error(friendlyError(error));
    },
  });

  const title =
    action === "mortality"
      ? "Record batch mortality"
      : action === "sale"
        ? "Record batch sale"
        : "Record batch transfer";

  return (
    <Dialog
      open={!!action}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {title} — {batch.batch_code}
          </DialogTitle>

          <DialogDescription>
            Current quantity:{" "}
            <strong>
              {batch.current_quantity.toLocaleString()}
            </strong>
            . The quantity will be reduced automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Quantity" required>
            <Input
              type="number"
              min="1"
              max={batch.current_quantity}
              step="1"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={`Maximum ${batch.current_quantity}`}
            />
          </Field>

          <Field label="Date">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>

          {action === "transfer" && (
            <SectionPicker
              farms={refData.farms}
              sections={refData.sections}
              farmId={farmId}
              sectionId={sectionId}
              onFarm={(id) => {
                setFarmId(id);
                setSectionId("");
              }}
              onSection={setSectionId}
            />
          )}

          <Field
            label={
              action === "mortality"
                ? "Cause / notes"
                : "Notes"
            }
          >
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                action === "mortality"
                  ? "e.g. Disease, weak birds, accident..."
                  : "Optional notes"
              }
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>

          <Button
            variant={
              action === "mortality"
                ? "destructive"
                : "default"
            }
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h3>

      <div className="divide-y rounded-lg border bg-background px-3">
        {children}
      </div>
    </section>
  );
}



function DeletionRequestButton({ recordType, recordId, label, original }: { recordType: "animal" | "batch"; recordId: string; label: string; original: unknown }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  async function submit() {
    if (reason.trim().length < 5) { toast.error("Please explain the reason (at least 5 characters)."); return; }
    setSaving(true);
    const { error } = await (supabase as any).from("record_change_requests").insert({ record_type: recordType, record_id: recordId, request_type: "delete", record_label: label, reason: reason.trim(), original_values: original });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Deletion request sent to CEO/Administrator");
    setOpen(false); setReason("");
    void qc.invalidateQueries({ queryKey: ["record-approvals-pending"] });
  }
  return <><Button variant="destructive" size="sm" onClick={() => setOpen(true)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Request deletion</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Request deletion — {label}</DialogTitle><DialogDescription>The record will remain unchanged until the CEO/Administrator approves. Explain why it should be deleted.</DialogDescription></DialogHeader><Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate entry or wrong livestock batch details (minimum 5 characters)" /><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button variant="destructive" disabled={saving || reason.trim().length < 5} onClick={() => void submit()}>{saving ? "Submitting…" : "Submit deletion request"}</Button></DialogFooter></DialogContent></Dialog></>;
}

