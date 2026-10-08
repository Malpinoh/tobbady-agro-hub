import { queryOptions } from "@tanstack/react-query";
import { differenceInMonths, differenceInDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Tone } from "@/components/app/PageKit";

type T = Database["public"]["Tables"];
export type LivestockType = T["livestock_types"]["Row"];
export type Breed = T["breeds"]["Row"];
export type Farm = T["farms"]["Row"];
export type FarmSection = T["farm_sections"]["Row"];
export type Animal = T["animals"]["Row"];
export type Batch = T["animal_batches"]["Row"];
export type BatchMovement = T["batch_movements"]["Row"];
export type BatchWithMovements = Batch & { batch_movements: Pick<BatchMovement, "movement_type" | "quantity">[] };

export const ANIMAL_STATUSES = ["active", "sold", "dead", "transferred", "missing", "quarantined"] as const;
export const BATCH_STATUSES = ["active", "closed", "quarantined"] as const;
export const MOVEMENT_TYPES = ["mortality", "sale", "transfer", "adjustment"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const STATUS_TONE: Record<string, Tone> = {
  active: "success", sold: "info", dead: "danger", transferred: "neutral",
  missing: "warning", quarantined: "warning", closed: "neutral",
};

export const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ageLabel(dob: string | null, now = new Date()): string {
  if (!dob) return "—";
  const d = new Date(dob);
  const months = differenceInMonths(now, d);
  if (months < 1) return `${Math.max(0, differenceInDays(now, d))} d`;
  if (months < 24) return `${months} mo`;
  const y = Math.floor(months / 12), m = months % 12;
  return m ? `${y} y ${m} mo` : `${y} y`;
}

/** Quantities removed from a batch, grouped by movement type. */
export function batchBreakdown(b: BatchWithMovements) {
  const sum = (t: MovementType) => b.batch_movements.filter((m) => m.movement_type === t).reduce((a, m) => a + m.quantity, 0);
  return { mortality: sum("mortality"), sold: sum("sale"), transferred: sum("transfer"), adjusted: sum("adjustment") };
}

export type LivestockStats = {
  total: number; individuals: number; birds: number; active: number;
  value: number; sold: number; dead: number; transferred: number;
};

/** Overview figures: individual animals count by head; batches by birds currently on hand. */
export function computeStats(animals: Animal[], batches: BatchWithMovements[]): LivestockStats {
  const activeAnimals = animals.filter((a) => a.status === "active");
  const birds = batches.reduce((a, b) => a + b.current_quantity, 0);
  const activeBirds = batches.filter((b) => b.status === "active").reduce((a, b) => a + b.current_quantity, 0);
  const bd = batches.map(batchBreakdown);
  const value =
    activeAnimals.reduce((a, x) => a + Number(x.estimated_value ?? 0), 0) +
    batches.filter((b) => b.status === "active").reduce((a, b) => a + b.current_quantity * Number(b.estimated_unit_value ?? 0), 0);
  return {
    total: activeAnimals.length + activeBirds,
    individuals: activeAnimals.length,
    birds,
    active: activeAnimals.length + activeBirds,
    value,
    sold: animals.filter((a) => a.status === "sold").length + bd.reduce((a, x) => a + x.sold, 0),
    dead: animals.filter((a) => a.status === "dead").length + bd.reduce((a, x) => a + x.mortality, 0),
    transferred: animals.filter((a) => a.status === "transferred").length + bd.reduce((a, x) => a + x.transferred, 0),
  };
}

export function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function must<D>(p: PromiseLike<{ data: D | null; error: { message: string } | null }>): Promise<D> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as D;
}

export const livestockKeys = { all: ["livestock"] as const };

export const referenceQuery = queryOptions({
  queryKey: [...livestockKeys.all, "reference"],
  queryFn: async () => {
    const [types, breeds, farms, sections] = await Promise.all([
      must(supabase.from("livestock_types").select("*").order("sort_order")),
      must(supabase.from("breeds").select("*").order("name")),
      must(supabase.from("farms").select("*").order("name")),
      must(supabase.from("farm_sections").select("*").order("name")),
    ]);
    return { types, breeds, farms, sections };
  },
});

export const animalsQuery = queryOptions({
  queryKey: [...livestockKeys.all, "animals"],
  queryFn: () => must(supabase.from("animals").select("*").order("created_at", { ascending: false })),
});

export const batchesQuery = queryOptions({
  queryKey: [...livestockKeys.all, "batches"],
  queryFn: async () =>
    (await must(
      supabase.from("animal_batches").select("*, batch_movements(movement_type, quantity)").order("created_at", { ascending: false }),
    )) as BatchWithMovements[],
});

export const activityQuery = (table: string, id: string) =>
  queryOptions({
    queryKey: [...livestockKeys.all, "activity", table, id],
    queryFn: () =>
      must(supabase.from("activity_logs").select("*").eq("table_name", table).eq("record_id", id).order("created_at", { ascending: false }).limit(25)),
  });

export const movementsQuery = (batchId: string) =>
  queryOptions({
    queryKey: [...livestockKeys.all, "movements", batchId],
    queryFn: () => must(supabase.from("batch_movements").select("*").eq("batch_id", batchId).order("occurred_on", { ascending: false })),
  });

/** Turn Postgres errors into readable messages. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/animals_tag_number_key|duplicate key.*tag_number/.test(msg)) return "That tag number is already in use.";
  if (/batch_code/.test(msg) && /duplicate/.test(msg)) return "That batch code is already in use.";
  if (/breeds_livestock_type_id_name/.test(msg)) return "That breed already exists for this livestock type.";
  if (/livestock_types_(name|slug)_key/.test(msg)) return "A livestock type with that name already exists.";
  if (/row-level security/.test(msg)) return "You don't have permission to make this change.";
  return msg;
}
