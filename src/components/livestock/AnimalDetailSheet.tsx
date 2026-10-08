import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowRightLeft, BadgeDollarSign, Pencil, Skull } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/app/PageKit";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/access";
import { STATUS_TONE, ageLabel, friendlyError, livestockKeys, titleCase, type Animal } from "@/lib/livestock";
import { ActivityList } from "./ActivityList";
import { Field, InfoRow, SectionPicker } from "./shared";
import type { Lookups, RefData } from "./types";

type Action = "transfer" | "mortality" | "sold" | null;
const fmt = (d: string | null) => (d ? format(new Date(d), "d MMM yyyy") : "—");

export function AnimalDetailSheet({ animal, onClose, onEdit, canManage, refData, lk }: {
  animal: Animal | null; onClose: () => void; onEdit: (a: Animal) => void; canManage: boolean; refData: RefData; lk: Lookups;
}) {
  const [action, setAction] = useState<Action>(null);
  const a = animal;
  const gain = a && a.estimated_value != null && a.acquisition_cost != null ? Number(a.estimated_value) - Number(a.acquisition_cost) : null;
  const closed = a ? a.status !== "active" && a.status !== "quarantined" && a.status !== "missing" : true;

  return (
    <>
      <Sheet open={!!a} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {a && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <SheetTitle className="font-display text-xl">{a.tag_number}</SheetTitle>
                  <StatusBadge tone={STATUS_TONE[a.status] ?? "neutral"}>{titleCase(a.status)}</StatusBadge>
                </div>
                <SheetDescription>{lk.typeName(a.livestock_type_id)} · {lk.breedName(a.breed_id)}</SheetDescription>
              </SheetHeader>
              {canManage && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(a)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
                  <Button variant="outline" size="sm" disabled={closed} onClick={() => setAction("transfer")}><ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />Record transfer</Button>
                  <Button variant="outline" size="sm" disabled={closed} onClick={() => setAction("mortality")}><Skull className="mr-1.5 h-3.5 w-3.5" />Record mortality</Button>
                  <Button variant="outline" size="sm" disabled={closed} onClick={() => setAction("sold")}><BadgeDollarSign className="mr-1.5 h-3.5 w-3.5" />Mark as sold</Button>
                </div>
              )}
              <div className="mt-6 space-y-6 px-1">
                <Section title="Basic information">
                  <InfoRow label="Tag number">{a.tag_number}</InfoRow>
                  <InfoRow label="Type">{lk.typeName(a.livestock_type_id)}</InfoRow>
                  <InfoRow label="Breed">{lk.breedName(a.breed_id)}</InfoRow>
                  <InfoRow label="Sex">{a.sex ? titleCase(a.sex) : "—"}</InfoRow>
                  <InfoRow label="Date of birth">{fmt(a.date_of_birth)}</InfoRow>
                  <InfoRow label="Age">{ageLabel(a.date_of_birth)}</InfoRow>
                  <InfoRow label="Status"><StatusBadge tone={STATUS_TONE[a.status] ?? "neutral"}>{titleCase(a.status)}</StatusBadge></InfoRow>
                </Section>
                <Section title="Location">
                  <InfoRow label="Farm">{lk.farmName(a.farm_section_id)}</InfoRow>
                  <InfoRow label="Section">{lk.sectionName(a.farm_section_id)}</InfoRow>
                  <InfoRow label="Current location">{a.farm_section_id ? `${lk.farmName(a.farm_section_id)} / ${lk.sectionName(a.farm_section_id)}` : a.status === "active" ? "Unassigned" : titleCase(a.status)}</InfoRow>
                </Section>
                <Section title="Financial">
                  <InfoRow label="Acquisition cost">{a.acquisition_cost != null ? formatNaira(Number(a.acquisition_cost)) : "—"}</InfoRow>
                  <InfoRow label="Estimated current value">{a.estimated_value != null ? formatNaira(Number(a.estimated_value)) : "—"}</InfoRow>
                  <InfoRow label="Potential gain / loss">
                    {gain == null ? "—" : <span className={gain >= 0 ? "text-success" : "text-destructive"}>{gain >= 0 ? "+" : "−"}{formatNaira(Math.abs(gain))}</span>}
                  </InfoRow>
                </Section>
                <Section title="Acquisition">
                  <InfoRow label="Acquisition date">{fmt(a.acquired_on)}</InfoRow>
                  <div className="pt-1 text-sm"><span className="text-muted-foreground">Notes</span><p className="mt-1 whitespace-pre-wrap">{a.notes || "—"}</p></div>
                </Section>
                <Section title="Activity"><ActivityList table="animals" id={a.id} /></Section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      {a && <ActionDialog animal={a} action={action} onClose={() => setAction(null)} refData={refData} lk={lk} />}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</h3>
      <div className="divide-y rounded-lg border bg-background px-3">{children}</div>
    </section>
  );
}

function ActionDialog({ animal, action, onClose, refData, lk }: { animal: Animal; action: Action; onClose: () => void; refData: RefData; lk: Lookups }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [price, setPrice] = useState("");
  const [mode, setMode] = useState<"internal" | "external">("internal");
  const [farmId, setFarmId] = useState(lk.farmIdOf(animal.farm_section_id));
  const [sectionId, setSectionId] = useState("");

  const m = useMutation({
    mutationFn: async () => {
      if (action === "transfer" && mode === "internal" && !sectionId) throw new Error("Choose the destination section.");
      if (action === "sold" && price && (isNaN(Number(price)) || Number(price) < 0)) throw new Error("Enter a valid sale price.");
      const label = action === "mortality" ? "Mortality recorded" : action === "sold" ? `Sold${price ? ` for ${formatNaira(Number(price))}` : ""}`
        : mode === "internal" ? `Moved to ${lk.farmName(sectionId)} / ${lk.sectionName(sectionId)}` : "Transferred out";
      const line = `[${date}] ${label}${note.trim() ? ` — ${note.trim()}` : ""}`;
      const patch: Partial<Animal> = { notes: animal.notes ? `${animal.notes}\n${line}` : line };
      if (action === "mortality") patch.status = "dead";
      if (action === "sold") patch.status = "sold";
      if (action === "transfer") { if (mode === "internal") patch.farm_section_id = sectionId; else patch.status = "transferred"; }
      const { error } = await supabase.from("animals").update(patch).eq("id", animal.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Record updated"); void qc.invalidateQueries({ queryKey: livestockKeys.all }); onClose(); setNote(""); setPrice(""); },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const title = action === "transfer" ? "Record transfer" : action === "mortality" ? "Record mortality" : "Mark as sold";
  return (
    <Dialog open={!!action} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title} — {animal.tag_number}</DialogTitle>
          <DialogDescription>
            {action === "mortality" && "The animal will be marked as dead. The record is kept for history and reporting."}
            {action === "sold" && "The animal will be marked as sold. Full invoicing will be handled in the Sales module."}
            {action === "transfer" && "Move the animal to another section, or record that it left the business."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {action === "transfer" && (
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="sm:col-span-2">
              <div className="flex items-center gap-2"><RadioGroupItem value="internal" id="t-int" /><Label htmlFor="t-int">Move to another section</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="external" id="t-ext" /><Label htmlFor="t-ext">Transferred out of the business</Label></div>
            </RadioGroup>
          )}
          {action === "transfer" && mode === "internal" && (
            <SectionPicker farms={refData.farms} sections={refData.sections} farmId={farmId} sectionId={sectionId} onFarm={setFarmId} onSection={setSectionId} />
          )}
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          {action === "sold" && <Field label="Sale price (₦)"><Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>}
          <Field label={action === "mortality" ? "Cause / notes" : "Notes"} className="sm:col-span-2"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant={action === "mortality" ? "destructive" : "default"} disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? "Saving…" : "Confirm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
