import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Warehouse, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader, Panel, RequirePermission } from "@/components/app/PageKit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { livestockKeys, friendlyError } from "@/lib/livestock";

export const Route = createFileRoute("/_authenticated/farm-operations")({
  head: () => ({
    meta: [
      { title: "Farm Operations — TOBADDY AGRO LIVESTOCK" },
      { name: "description", content: "Manage farms and livestock sections." },
    ],
  }),
  component: FarmOperationsPage,
});

function FarmOperationsPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canManage = can("farm.manage");

  const [farmName, setFarmName] = useState("");
  const [farmLocation, setFarmLocation] = useState("");
  const [farmNotes, setFarmNotes] = useState("");

  const [sectionFarm, setSectionFarm] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [sectionType, setSectionType] = useState("");
  const [sectionCapacity, setSectionCapacity] = useState("");

  const farmsQuery = useQuery({
    queryKey: [...livestockKeys.all, "farms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farms")
        .select("*")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const sectionsQuery = useQuery({
    queryKey: [...livestockKeys.all, "farm-sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farm_sections")
        .select("*")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const refreshData = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: [...livestockKeys.all, "farms"] }),
      qc.invalidateQueries({ queryKey: [...livestockKeys.all, "farm-sections"] }),
      qc.invalidateQueries({ queryKey: [...livestockKeys.all, "reference"] }),
      qc.invalidateQueries({ queryKey: [...livestockKeys.all, "animals"] }),
      qc.invalidateQueries({ queryKey: [...livestockKeys.all, "batches"] }),
    ]);
  };

  const addFarm = useMutation({
    mutationFn: async () => {
      const name = farmName.trim();
      if (!name) throw new Error("Enter a farm name.");
      const { error } = await supabase.from("farms").insert({
        name,
        location: farmLocation.trim() || null,
        notes: farmNotes.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Farm added successfully.");
      setFarmName("");
      setFarmLocation("");
      setFarmNotes("");
      await refreshData();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const addSection = useMutation({
    mutationFn: async () => {
      if (!sectionFarm) throw new Error("Choose a farm.");
      if (!sectionName.trim()) throw new Error("Enter a section name.");

      const capacity = sectionCapacity.trim()
        ? Number(sectionCapacity)
        : null;

      if (
        capacity !== null &&
        (!Number.isInteger(capacity) || capacity < 0)
      ) {
        throw new Error("Capacity must be a non-negative whole number.");
      }

      const { error } = await supabase.from("farm_sections").insert({
        farm_id: sectionFarm,
        name: sectionName.trim(),
        section_type: sectionType.trim() || null,
        capacity,
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Farm section added successfully.");
      setSectionName("");
      setSectionType("");
      setSectionCapacity("");
      await refreshData();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const deleteFarm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("farms").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Farm deleted.");
      await refreshData();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("farm_sections")
        .delete()
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Section deleted.");
      await refreshData();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const farms = farmsQuery.data ?? [];
  const sections = sectionsQuery.data ?? [];
  const loading = farmsQuery.isLoading || sectionsQuery.isLoading;
  const queryError = farmsQuery.error || sectionsQuery.error;

  return (
    <RequirePermission perm="farm.view">
      <PageHeader
        title="Farm Operations"
        description="Manage farm locations, sections and livestock housing."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void farmsQuery.refetch();
              void sectionsQuery.refetch();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {canManage && (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Register a farm">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                addFarm.mutate();
              }}
            >
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Farm name *
                </label>
                <Input
                  value={farmName}
                  onChange={(event) => setFarmName(event.target.value)}
                  placeholder="e.g. Main Farm"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Location
                </label>
                <Input
                  value={farmLocation}
                  onChange={(event) => setFarmLocation(event.target.value)}
                  placeholder="Town, state or address"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Notes
                </label>
                <Textarea
                  value={farmNotes}
                  onChange={(event) => setFarmNotes(event.target.value)}
                  placeholder="Optional farm details"
                />
              </div>

              <Button type="submit" disabled={addFarm.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                {addFarm.isPending ? "Saving..." : "Add Farm"}
              </Button>
            </form>
          </Panel>

          <Panel title="Create a farm section">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                addSection.mutate();
              }}
            >
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Select farm *
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={sectionFarm}
                  onChange={(event) => setSectionFarm(event.target.value)}
                  required
                >
                  <option value="">Choose a farm</option>
                  {farms.map((farm) => (
                    <option key={farm.id} value={farm.id}>
                      {farm.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Section name *
                </label>
                <Input
                  value={sectionName}
                  onChange={(event) => setSectionName(event.target.value)}
                  placeholder="e.g. Cattle Pen A"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Section type
                </label>
                <Input
                  value={sectionType}
                  onChange={(event) => setSectionType(event.target.value)}
                  placeholder="e.g. Cattle pen, poultry house, grazing area"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Capacity (number of animals)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={sectionCapacity}
                  onChange={(event) => setSectionCapacity(event.target.value)}
                  placeholder="Optional"
                />
              </div>

              <Button
                type="submit"
                disabled={addSection.isPending || farms.length === 0}
              >
                <Plus className="mr-2 h-4 w-4" />
                {addSection.isPending ? "Saving..." : "Add Section"}
              </Button>

              {farms.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Register a farm before creating its sections.
                </p>
              )}
            </form>
          </Panel>
        </div>
      )}

      <Panel title={`Registered Farms (${farms.length})`}>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading farms...</p>
        ) : queryError ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              Could not load farm data: {queryError.message}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                void farmsQuery.refetch();
                void sectionsQuery.refetch();
              }}
            >
              Try again
            </Button>
          </div>
        ) : farms.length === 0 ? (
          <div className="py-8 text-center">
            <Warehouse className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No farms registered yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {canManage
                ? "Use the form above to register your first farm."
                : "Ask an administrator to register a farm."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {farms.map((farm) => {
              const farmSections = sections.filter(
                (section) => section.farm_id === farm.id
              );

              return (
                <div
                  key={farm.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{farm.name}</h3>
                      {farm.location && (
                        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 shrink-0" />
                          {farm.location}
                        </p>
                      )}
                      {farm.notes && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                          {farm.notes}
                        </p>
                      )}
                      <p className="mt-2 text-sm">
                        {farmSections.length} section
                        {farmSections.length === 1 ? "" : "s"}
                      </p>
                    </div>

                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={deleteFarm.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete "${farm.name}"? Its sections will also be deleted.`
                            )
                          ) {
                            deleteFarm.mutate(farm.id);
                          }
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete farm
                      </Button>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    {farmSections.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No sections added to this farm yet.
                      </p>
                    ) : (
                      farmSections.map((section) => (
                        <div
                          key={section.id}
                          className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-3"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {section.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {[section.section_type, section.capacity != null
                                ? `Capacity: ${section.capacity}`
                                : null]
                                .filter(Boolean)
                                .join(" · ") || "Section details not specified"}
                            </p>
                          </div>

                          {canManage && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${section.name}`}
                              disabled={deleteSection.isPending}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete section "${section.name}"?`
                                  )
                                ) {
                                  deleteSection.mutate(section.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </RequirePermission>
  );
}
