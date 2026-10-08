import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  friendlyError,
  livestockKeys,
  type Batch,
} from "@/lib/livestock";

import { Field, SectionPicker, SimpleSelect } from "./shared";
import type { RefData } from "./types";

const empty = {
  batch_code: "",
  livestock_type_id: "",
  breed_id: "",
  initial_quantity: "",
  started_on: "",
  acquisition_cost: "",
  estimated_unit_value: "",
  farm_id: "",
  farm_section_id: "",
  status: "active",
  notes: "",
};

export function BatchFormDialog({
  open,
  onOpenChange,
  batch,
  refData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch?: Batch | null;
  refData: RefData;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<
    Partial<Record<keyof typeof empty, string>>
  >({});

  const types = refData.types.filter(
    (t) =>
      t.tracking_method === "batch" &&
      (t.is_active || t.id === batch?.livestock_type_id),
  );

  useEffect(() => {
    if (!open) return;

    setErrors({});

    if (batch) {
      const section = refData.sections.find(
        (s) => s.id === batch.farm_section_id,
      );

      setF({
        batch_code: batch.batch_code,
        livestock_type_id: batch.livestock_type_id,
        breed_id: batch.breed_id ?? "",
        initial_quantity: String(batch.initial_quantity),
        started_on: batch.started_on ?? "",
        acquisition_cost:
          batch.acquisition_cost != null
            ? String(batch.acquisition_cost)
            : "",
        estimated_unit_value:
          batch.estimated_unit_value != null
            ? String(batch.estimated_unit_value)
            : "",
        farm_id: section?.farm_id ?? "",
        farm_section_id: batch.farm_section_id ?? "",
        status: batch.status,
        notes: batch.notes ?? "",
      });
    } else {
      setF({
        ...empty,
        started_on: new Date().toISOString().slice(0, 10),
      });
    }
  }, [open, batch, refData.sections]);

  const set =
    (key: keyof typeof empty) =>
    (value: string) => {
      setF((previous) => ({
        ...previous,
        [key]: value,
      }));
    };

  const save = useMutation({
    mutationFn: async () => {
      const validation: Partial<
        Record<keyof typeof empty, string>
      > = {};

      const code = f.batch_code.trim();

      if (!code) {
        validation.batch_code = "Batch code is required";
      }

      if (!f.livestock_type_id) {
        validation.livestock_type_id = "Choose a livestock type";
      }

      const quantity = Number(f.initial_quantity);

      if (!f.initial_quantity || !Number.isInteger(quantity) || quantity <= 0) {
        validation.initial_quantity =
          "Enter a whole number greater than zero";
      }

      for (const key of [
        "acquisition_cost",
        "estimated_unit_value",
      ] as const) {
        if (
          f[key] &&
          (isNaN(Number(f[key])) || Number(f[key]) < 0)
        ) {
          validation[key] = "Enter a valid amount";
        }
      }

      if (code && !validation.batch_code) {
        const { data } = await supabase
          .from("animal_batches")
          .select("id")
          .ilike("batch_code", code)
          .limit(1);

        if (data?.length && data[0]!.id !== batch?.id) {
          validation.batch_code = "That batch code is already in use";
        }
      }

      setErrors(validation);

      if (Object.keys(validation).length) {
        throw new Error("validation");
      }

      const payload = {
        batch_code: code,
        livestock_type_id: f.livestock_type_id,
        breed_id: f.breed_id || null,
        initial_quantity: quantity,
        started_on: f.started_on || null,
        acquisition_cost: f.acquisition_cost
          ? Number(f.acquisition_cost)
          : null,
        estimated_unit_value: f.estimated_unit_value
          ? Number(f.estimated_unit_value)
          : null,
        farm_section_id: f.farm_section_id || null,
        status: f.status,
        notes: f.notes.trim() || null,
      };

      if (batch) {
        const { error } = await supabase
          .from("animal_batches")
          .update(payload)
          .eq("id", batch.id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("animal_batches")
          .insert({
            ...payload,
            created_by: user?.id ?? null,
          });

        if (error) throw new Error(error.message);
      }
    },

    onSuccess: () => {
      toast.success(
        batch
          ? "Batch updated successfully"
          : "Batch added successfully",
      );

      void qc.invalidateQueries({
        queryKey: livestockKeys.all,
      });

      onOpenChange(false);
    },

    onError: (error) => {
      if (error instanceof Error && error.message === "validation") {
        return;
      }

      toast.error(friendlyError(error));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {batch ? `Edit ${batch.batch_code}` : "Add livestock batch"}
          </DialogTitle>

          <DialogDescription>
            Create a batch for poultry or other livestock tracked by quantity.
            Current quantity is automatically calculated from recorded
            movements.
          </DialogDescription>
        </DialogHeader>

        {!types.length ? (
          <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
            No active batch-tracked livestock types exist.
            Add a livestock type with tracking method set to Batch first.
          </div>
        ) : (
          <form
            id="batch-form"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <Field
              label="Batch code"
              required
              error={errors.batch_code}
            >
              <Input
                value={f.batch_code}
                onChange={(e) =>
                  set("batch_code")(e.target.value)
                }
                placeholder="e.g. BRO-2026-001"
              />
            </Field>

            <Field
              label="Livestock type"
              required
              error={errors.livestock_type_id}
            >
              <SimpleSelect
                value={f.livestock_type_id}
                onChange={(value) => {
                  set("livestock_type_id")(value);
                  set("breed_id")("");
                }}
                placeholder="Select type"
                options={types.map((type) => ({
                  value: type.id,
                  label: type.name,
                }))}
              />
            </Field>

            <Field label="Breed">
              <SimpleSelect
                value={f.breed_id}
                onChange={set("breed_id")}
                allowNone
                noneLabel={
                  f.livestock_type_id
                    ? "Unspecified"
                    : "Select a type first"
                }
                disabled={!f.livestock_type_id}
                options={refData.breeds
                  .filter(
                    (breed) =>
                      breed.livestock_type_id ===
                      f.livestock_type_id,
                  )
                  .map((breed) => ({
                    value: breed.id,
                    label: breed.name,
                  }))}
              />
            </Field>

            <Field
              label="Initial quantity"
              required
              error={errors.initial_quantity}
            >
              <Input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={f.initial_quantity}
                onChange={(e) =>
                  set("initial_quantity")(e.target.value)
                }
                placeholder="e.g. 500"
              />
            </Field>

            <Field label="Start / acquisition date">
              <Input
                type="date"
                value={f.started_on}
                onChange={(e) =>
                  set("started_on")(e.target.value)
                }
              />
            </Field>

            <Field
              label="Acquisition cost (₦)"
              error={errors.acquisition_cost}
            >
              <Input
                inputMode="decimal"
                value={f.acquisition_cost}
                onChange={(e) =>
                  set("acquisition_cost")(e.target.value)
                }
                placeholder="Total batch cost"
              />
            </Field>

            <Field
              label="Estimated value per unit (₦)"
              error={errors.estimated_unit_value}
            >
              <Input
                inputMode="decimal"
                value={f.estimated_unit_value}
                onChange={(e) =>
                  set("estimated_unit_value")(e.target.value)
                }
                placeholder="e.g. 3500"
              />
            </Field>

            <SectionPicker
              farms={refData.farms}
              sections={refData.sections}
              farmId={f.farm_id}
              sectionId={f.farm_section_id}
              onFarm={set("farm_id")}
              onSection={set("farm_section_id")}
            />

            <Field label="Status">
              <SimpleSelect
                value={f.status}
                onChange={set("status")}
                options={[
                  { value: "active", label: "Active" },
                  { value: "closed", label: "Closed" },
                  { value: "quarantined", label: "Quarantined" },
                ]}
              />
            </Field>

            <Field
              label="Notes"
              className="sm:col-span-2"
            >
              <Textarea
                rows={3}
                value={f.notes}
                onChange={(e) =>
                  set("notes")(e.target.value)
                }
                placeholder="Optional notes about this batch"
              />
            </Field>
          </form>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="batch-form"
            disabled={save.isPending || !types.length}
          >
            {save.isPending
              ? "Saving…"
              : batch
                ? "Save changes"
                : "Add batch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
