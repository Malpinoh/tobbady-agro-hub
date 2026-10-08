import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { activityQuery } from "@/lib/livestock";

const FIELDS: Record<string, string> = {
  status: "Status", farm_section_id: "Location", estimated_value: "Estimated value", breed_id: "Breed",
  tag_number: "Tag number", current_quantity: "Current quantity", notes: "Notes", acquisition_cost: "Acquisition cost",
};

function describe(row: { action: string; old_values: unknown; new_values: unknown; description: string | null }) {
  if (row.description) return row.description;
  if (row.action === "insert") return "Record created";
  if (row.action === "delete") return "Record deleted";
  const o = (row.old_values ?? {}) as Record<string, unknown>;
  const n = (row.new_values ?? {}) as Record<string, unknown>;
  const changed = Object.keys(FIELDS).filter((k) => JSON.stringify(o[k]) !== JSON.stringify(n[k]));
  if (!changed.length) return "Record updated";
  return changed.map((k) => (k === "status" ? `Status: ${String(o[k])} → ${String(n[k])}` : `${FIELDS[k]} changed`)).join(" · ");
}

export function ActivityList({ table, id }: { table: string; id: string }) {
  const q = useQuery(activityQuery(table, id));
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading activity…</p>;
  if (q.error) return <p className="text-sm text-muted-foreground">Activity history isn't available for your role.</p>;
  if (!q.data?.length) return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>;
  return (
    <ol className="space-y-3 border-l pl-4">
      {q.data.map((r) => (
        <li key={r.id} className="relative text-sm">
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-gold" />
          <div className="font-medium">{describe(r)}</div>
          <div className="text-xs text-muted-foreground">{format(new Date(r.created_at), "d MMM yyyy, HH:mm")}</div>
        </li>
      ))}
    </ol>
  );
}
