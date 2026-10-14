import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/access";

/**
 * Human-readable rendering of a record submitted for CEO/Administrator approval.
 * Raw ids are resolved to names; internal workflow columns are hidden.
 */

type Kind = "text" | "date" | "datetime" | "money" | "number" | "type" | "breed" | "farm" | "section" | "user" | "status";
type FieldDef = { label: string; kind: Kind };

const FIELDS: Record<string, FieldDef> = {
  tag_number: { label: "Tag number", kind: "text" },
  batch_code: { label: "Batch code", kind: "text" },
  name: { label: "Item name", kind: "text" },
  sku: { label: "Item code", kind: "text" },
  category: { label: "Category", kind: "text" },
  livestock_type_id: { label: "Livestock type", kind: "type" },
  breed_id: { label: "Breed", kind: "breed" },
  sex: { label: "Sex", kind: "status" },
  date_of_birth: { label: "Date of birth", kind: "date" },
  acquired_on: { label: "Date obtained", kind: "date" },
  started_on: { label: "Start date", kind: "date" },
  initial_quantity: { label: "Initial quantity", kind: "number" },
  current_quantity: { label: "Current quantity", kind: "number" },
  submitted_quantity: { label: "Submitted quantity", kind: "number" },
  quantity_on_hand: { label: "Quantity on hand", kind: "number" },
  unit: { label: "Unit", kind: "text" },
  reorder_level: { label: "Low-stock limit", kind: "number" },
  acquisition_cost: { label: "Purchase cost", kind: "money" },
  estimated_value: { label: "Estimated value", kind: "money" },
  estimated_unit_value: { label: "Estimated unit value", kind: "money" },
  unit_cost: { label: "Unit cost", kind: "money" },
  farm_id: { label: "Farm", kind: "farm" },
  farm_section_id: { label: "Section", kind: "section" },
  location_description: { label: "Location", kind: "text" },
  status: { label: "Status", kind: "status" },
  notes: { label: "Notes", kind: "text" },
  submitted_by: { label: "Submitted by", kind: "user" },
  created_by: { label: "Created by", kind: "user" },
  created_at: { label: "Submitted on", kind: "datetime" },
};

const HIDDEN = new Set(["id", "approval_status", "approved_by", "approved_at", "rejection_reason", "updated_at"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Lookups = Record<"type" | "breed" | "farm" | "section" | "user", Map<string, string>>;

export function useApprovalLookups(enabled: boolean) {
  return useQuery({
    queryKey: ["approval-lookups"],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<Lookups> => {
      const [t, b, f, s, p] = await Promise.all([
        supabase.from("livestock_types").select("id, name"),
        supabase.from("breeds").select("id, name"),
        supabase.from("farms").select("id, name"),
        supabase.from("farm_sections").select("id, name"),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      const toMap = (rows: { id: string; name: string }[] | null) => new Map((rows ?? []).map((r) => [r.id, r.name]));
      return {
        type: toMap(t.data),
        breed: toMap(b.data),
        farm: toMap(f.data),
        section: toMap(s.data),
        user: new Map((p.data ?? []).map((r) => [r.id, r.full_name || r.email || "Staff member"])),
      };
    },
  });
}

const humanize = (key: string) => key.replace(/_id$/, "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function formatValue(key: string, value: unknown, lookups?: Lookups): string {
  if (value === null || value === undefined || value === "") return "—";
  const def = FIELDS[key];
  const kind = def?.kind ?? "text";
  const str = String(value);
  switch (kind) {
    case "money": {
      const n = Number(value);
      return Number.isFinite(n) ? formatNaira(n) : str;
    }
    case "number": {
      const n = Number(value);
      return Number.isFinite(n) ? n.toLocaleString("en-NG") : str;
    }
    case "date": {
      const d = new Date(`${str.slice(0, 10)}T00:00:00`);
      return Number.isNaN(d.getTime()) ? str : d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
    }
    case "datetime": {
      const d = new Date(str);
      return Number.isNaN(d.getTime()) ? str : d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
    }
    case "status":
      return str.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
    case "type":
    case "breed":
    case "farm":
    case "section":
    case "user":
      return lookups?.[kind].get(str) ?? (kind === "user" ? "Staff member" : "Unknown (removed or not visible)");
    default:
      if (typeof value === "boolean") return value ? "Yes" : "No";
      if (typeof value === "object") return JSON.stringify(value);
      return str;
  }
}

/** Ordered list of displayable keys for one or more records. */
export function displayKeys(...records: unknown[]): string[] {
  const keys = new Set<string>();
  for (const r of records) {
    if (r && typeof r === "object") for (const k of Object.keys(r)) keys.add(k);
  }
  const known = Object.keys(FIELDS).filter((k) => keys.has(k));
  const extra = [...keys].filter((k) => !FIELDS[k] && !HIDDEN.has(k) && !k.endsWith("_id")).sort();
  return [...known, ...extra].filter((k) => !HIDDEN.has(k));
}

export const fieldLabel = (key: string) => FIELDS[key]?.label ?? humanize(key);

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export function RecordFields({ values, lookups }: { values: unknown; lookups: Lookups | undefined }) {
  const rec = asRecord(values);
  const keys = displayKeys(rec).filter((k) => !(typeof rec[k] === "string" && UUID_RE.test(String(rec[k])) && !FIELDS[k]));
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {keys.map((k) => (
        <div key={k} className="min-w-0 border-b pb-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{fieldLabel(k)}</dt>
          <dd className="mt-0.5 break-words text-sm">{formatValue(k, rec[k], lookups)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ChangeComparison({ original, proposed, lookups }: { original: unknown; proposed: unknown; lookups: Lookups | undefined }) {
  const o = asRecord(original);
  const p = asRecord(proposed);
  const keys = displayKeys(o, p);
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="p-2">Field</th>
            <th className="p-2">Current value</th>
            <th className="p-2">Proposed value</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const has = k in p;
            const changed = has && JSON.stringify(p[k] ?? null) !== JSON.stringify(o[k] ?? null);
            return (
              <tr key={k} className={`border-t ${changed ? "bg-accent/20" : ""}`}>
                <td className="p-2 font-medium">{fieldLabel(k)}{changed && <span className="ml-1 text-xs text-primary">(changed)</span>}</td>
                <td className="p-2 break-words">{formatValue(k, o[k], lookups)}</td>
                <td className="p-2 break-words">{has ? formatValue(k, p[k], lookups) : <span className="text-muted-foreground">No change</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
