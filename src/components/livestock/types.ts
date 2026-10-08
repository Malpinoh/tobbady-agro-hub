import type { Breed, Farm, FarmSection, LivestockType } from "@/lib/livestock";

export type RefData = { types: LivestockType[]; breeds: Breed[]; farms: Farm[]; sections: FarmSection[] };

/** Lookup helpers built once per render from reference data. */
export function makeLookups(r: RefData) {
  const type = new Map(r.types.map((t) => [t.id, t]));
  const breed = new Map(r.breeds.map((b) => [b.id, b]));
  const section = new Map(r.sections.map((s) => [s.id, s]));
  const farm = new Map(r.farms.map((f) => [f.id, f]));
  return {
    typeName: (id: string) => type.get(id)?.name ?? "—",
    unit: (id: string) => type.get(id)?.unit_label ?? "",
    breedName: (id: string | null) => (id ? breed.get(id)?.name ?? "—" : "—"),
    sectionName: (id: string | null) => (id ? section.get(id)?.name ?? "—" : "—"),
    farmIdOf: (sectionId: string | null) => (sectionId ? section.get(sectionId)?.farm_id ?? "" : ""),
    farmName: (sectionId: string | null) => {
      const s = sectionId ? section.get(sectionId) : undefined;
      return s ? farm.get(s.farm_id)?.name ?? "—" : "—";
    },
  };
}
export type Lookups = ReturnType<typeof makeLookups>;
