import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Inbox } from "lucide-react";
import type { Farm, FarmSection } from "@/lib/livestock";

export const NONE = "__none";
export const ALL = "__all";

export function Field({ label, required, error, children, className }: { label: string; required?: boolean; error?: string | undefined; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function SimpleSelect({ value, onChange, options, placeholder, allowNone, noneLabel = "None", disabled, ariaLabel }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
  placeholder?: string; allowNone?: boolean; noneLabel?: string; disabled?: boolean; ariaLabel?: string;
}) {
  return (
    <Select value={value || (allowNone ? NONE : undefined)} onValueChange={(v) => onChange(v === NONE ? "" : v)} disabled={!!disabled}>
      <SelectTrigger aria-label={ariaLabel}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** Farm → section cascade. Value is the section id; the farm is derived. */
export function SectionPicker({ farms, sections, sectionId, farmId, onFarm, onSection }: {
  farms: Farm[]; sections: FarmSection[]; sectionId: string; farmId: string;
  onFarm: (id: string) => void; onSection: (id: string) => void;
}) {
  if (!farms.length) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground sm:col-span-2">
        No farms are set up yet. <Link to="/farm-operations" className="font-medium text-primary underline">Add farms in Farm Operations</Link> to assign a location.
      </div>
    );
  }
  const farmSections = sections.filter((s) => s.farm_id === farmId);
  return (
    <>
      <Field label="Farm">
        <SimpleSelect value={farmId} onChange={(v) => { onFarm(v); onSection(""); }} allowNone noneLabel="Unassigned"
          options={farms.map((f) => ({ value: f.id, label: f.name }))} />
      </Field>
      <Field label="Section">
        <SimpleSelect value={sectionId} onChange={onSection} allowNone noneLabel={farmId ? "No section" : "Select a farm first"} disabled={!farmId}
          options={farmSections.map((s) => ({ value: s.id, label: s.name }))} />
      </Field>
    </>
  );
}

export function LoadingRows() {
  return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <div>
        <p className="font-medium">Couldn't load records</p>
        <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Please check your connection."}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary"><Inbox className="h-6 w-6" /></div>
      <div><p className="font-semibold">{title}</p><p className="mx-auto max-w-sm text-sm text-muted-foreground">{body}</p></div>
      {action}
    </div>
  );
}

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}
