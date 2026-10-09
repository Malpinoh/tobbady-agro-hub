import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ANIMAL_STATUSES, friendlyError, livestockKeys, titleCase, type Animal } from "@/lib/livestock";
import { Field, SectionPicker, SimpleSelect } from "./shared";
import type { RefData } from "./types";

const empty = { tag_number: "", livestock_type_id: "", breed_id: "", sex: "", date_of_birth: "", acquired_on: "", acquisition_cost: "", estimated_value: "", farm_id: "", farm_section_id: "", status: "active", notes: "", location_description: "" };

export function AnimalFormDialog({ open, onOpenChange, animal, refData }: { open: boolean; onOpenChange: (o: boolean) => void; animal?: Animal | null; refData: RefData }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof empty, string>>>({});
  const types = refData.types.filter((t) => t.tracking_method === "individual" && (t.is_active || t.id === animal?.livestock_type_id));

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (animal) {
      const sec = refData.sections.find((s) => s.id === animal.farm_section_id);
      setF({
        tag_number: animal.tag_number, livestock_type_id: animal.livestock_type_id, breed_id: animal.breed_id ?? "", sex: animal.sex ?? "",
        date_of_birth: animal.date_of_birth ?? "", acquired_on: animal.acquired_on ?? "",
        acquisition_cost: animal.acquisition_cost?.toString() ?? "", estimated_value: animal.estimated_value?.toString() ?? "",
        farm_id: animal.farm_id ?? sec?.farm_id ?? "", farm_section_id: animal.farm_section_id ?? "", status: animal.status, notes: animal.notes ?? "", location_description: animal.location_description ?? "",
      });
    } else setF(empty);
  }, [open, animal, refData.sections]);

  const set = (k: keyof typeof empty) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const e: Partial<Record<keyof typeof empty, string>> = {};
      const tag = f.tag_number.trim();
      if (!tag) e.tag_number = "Tag number is required";
      if (!f.livestock_type_id) e.livestock_type_id = "Choose a livestock type";
      for (const k of ["acquisition_cost", "estimated_value"] as const) {
        if (f[k] && (isNaN(Number(f[k])) || Number(f[k]) < 0)) e[k] = "Enter a valid amount";
      }
      if (f.date_of_birth && f.acquired_on && f.acquired_on < f.date_of_birth) e.acquired_on = "Acquisition can't be before birth";
      if (tag && !e.tag_number) {
        const { data } = await supabase.from("animals").select("id").ilike("tag_number", tag).limit(1);
        if (data?.length && data[0]!.id !== animal?.id) e.tag_number = "That tag number is already in use";
      }
      setErrors(e);
      if (Object.keys(e).length) throw new Error("validation");
      const payload = {
        tag_number: tag, livestock_type_id: f.livestock_type_id, breed_id: f.breed_id || null, sex: f.sex || null,
        date_of_birth: f.date_of_birth || null, acquired_on: f.acquired_on || null,
        acquisition_cost: f.acquisition_cost ? Number(f.acquisition_cost) : null, estimated_value: f.estimated_value ? Number(f.estimated_value) : null,
        farm_id: f.farm_id || null, farm_section_id: f.farm_section_id || null, location_description: f.location_description.trim() || null, status: f.status, notes: f.notes.trim() || null,
      };
      const { error } = animal
        ? await supabase.from("animals").update(payload).eq("id", animal.id)
        : await supabase.from("animals").insert({ ...payload, created_by: user?.id ?? null });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(animal ? "Animal updated" : "Animal added to the register");
      void qc.invalidateQueries({ queryKey: livestockKeys.all });
      onOpenChange(false);
    },
    onError: (e) => { if (e.message !== "validation") toast.error(friendlyError(e)); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{animal ? `Edit ${animal.tag_number}` : "Add animal"}</DialogTitle>
          <DialogDescription>Individually tracked livestock, identified by tag number.</DialogDescription>
        </DialogHeader>
        {!types.length ? (
          <p className="text-sm text-muted-foreground">No active individually tracked livestock types exist. Add one under Types &amp; Breeds.</p>
        ) : (
          <form id="animal-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <Field label="Tag number" required error={errors.tag_number}><Input value={f.tag_number} onChange={(e) => set("tag_number")(e.target.value)} placeholder="e.g. CT-0012" /></Field>
            <Field label="Livestock type" required error={errors.livestock_type_id}>
              <SimpleSelect value={f.livestock_type_id} onChange={(v) => { set("livestock_type_id")(v); set("breed_id")(""); }} placeholder="Select type"
                options={types.map((t) => ({ value: t.id, label: t.name }))} />
            </Field>
            <Field label="Breed">
              <SimpleSelect value={f.breed_id} onChange={set("breed_id")} allowNone noneLabel={f.livestock_type_id ? "Unspecified" : "Select a type first"} disabled={!f.livestock_type_id}
                options={refData.breeds.filter((b) => b.livestock_type_id === f.livestock_type_id).map((b) => ({ value: b.id, label: b.name }))} />
            </Field>
            <Field label="Sex">
              <SimpleSelect value={f.sex} onChange={set("sex")} allowNone noneLabel="Unknown" options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
            </Field>
            <Field label="Date of birth"><Input type="date" value={f.date_of_birth} onChange={(e) => set("date_of_birth")(e.target.value)} /></Field>
            <Field label="Acquisition date" error={errors.acquired_on}><Input type="date" value={f.acquired_on} onChange={(e) => set("acquired_on")(e.target.value)} /></Field>
            <Field label="Acquisition cost (₦)" error={errors.acquisition_cost}><Input inputMode="decimal" value={f.acquisition_cost} onChange={(e) => set("acquisition_cost")(e.target.value)} /></Field>
            <Field label="Estimated current value (₦)" error={errors.estimated_value}><Input inputMode="decimal" value={f.estimated_value} onChange={(e) => set("estimated_value")(e.target.value)} /></Field>
            <SectionPicker   farms={refData.farms}   sections={refData.sections}   farmId={f.farm_id}   sectionId={f.farm_section_id}   onFarm={set("farm_id")}   onSection={set("farm_section_id")} />  <Field label="Specific location (optional)">   <Input     value={f.location_description}     onChange={(e) => set("location_description")(e.target.value)}     placeholder="e.g. Open Compound or Behind Poultry House"   /> </Field>
            <Field label="Status">
              <SimpleSelect value={f.status} onChange={set("status")} options={ANIMAL_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))} />
            </Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea rows={3} value={f.notes} onChange={(e) => set("notes")(e.target.value)} /></Field>
          </form>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="animal-form" disabled={save.isPending || !types.length}>{save.isPending ? "Saving…" : animal ? "Save changes" : "Add animal"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
