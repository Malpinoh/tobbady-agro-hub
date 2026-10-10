import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Bird,
  Boxes,
  DollarSign,
  Filter,
  PawPrint,
  Plus,
  RefreshCw,
  Search,
  Skull,
  Tag,
  TrendingUp,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  PageHeader,
  Panel,
  RequirePermission,
  StatusBadge,
} from "@/components/app/PageKit";

import {
  animalsQuery,
  batchesQuery,
  computeStats,
  referenceQuery,
  STATUS_TONE,
  titleCase,
  type Animal,
  type Batch,
  type BatchWithMovements,
} from "@/lib/livestock";

import { useAuth } from "@/hooks/use-auth";
import { formatNaira } from "@/lib/access";
import {
  AnimalFormDialog,
} from "./AnimalFormDialog";
import { BatchDetailSheet } from "./BatchDetailSheet";
import { BatchFormDialog } from "./BatchFormDialog";

import {
  AnimalDetailSheet,
} from "./AnimalDetailSheet";

import {
  EmptyState,
  ErrorState,
  LoadingRows,
  SimpleSelect,
} from "./shared";

import {
  makeLookups,
} from "./types";


type Tab = "overview" | "animals" | "batches";

const NONE = "__none";

function StatCard({
  label,
  value,
  icon: Icon,
  description,
}: {
  label: string;
  value: string;
  icon: typeof PawPrint;
  description?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular">
            {value}
          </div>
          {description && (
            <div className="mt-1 text-xs text-muted-foreground">
              {description}
            </div>
          )}
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function statusTone(status: string) {
  return STATUS_TONE[status] ?? "neutral";
}

function AnimalTable({
  animals,
  lk,
  onSelect,
  onAdd,
}: {
  animals: Animal[];
  lk: ReturnType<typeof makeLookups>;
  onSelect: (animal: Animal) => void;
  onAdd: () => void;
}) {
  if (!animals.length) {
    return (
      <EmptyState
        title="No animals found"
        body="There are no individual animals matching the current filters."
        action={
          <Button onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add animal
          </Button>
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[850px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-3 font-medium">Animal</th>
            <th className="px-3 py-3 font-medium">Type</th>
            <th className="px-3 py-3 font-medium">Breed</th>
            <th className="px-3 py-3 font-medium">Sex</th>
            <th className="px-3 py-3 font-medium">Location</th>
            <th className="px-3 py-3 font-medium">Value</th>
            <th className="px-3 py-3 font-medium">Status</th>
          </tr>
        </thead>

        <tbody>
          {animals.map((animal) => (
            <tr
              key={animal.id}
              className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
              onClick={() => onSelect(animal)}
            >
              <td className="px-3 py-3">
                <div className="font-semibold">{animal.tag_number}</div>
                <div className="text-xs text-muted-foreground">
                  {animal.date_of_birth
                    ? new Date(animal.date_of_birth).toLocaleDateString("en-NG")
                    : "DOB not recorded"}
                </div>
              </td>

              <td className="px-3 py-3">
                {lk.typeName(animal.livestock_type_id)}
              </td>

              <td className="px-3 py-3">
                {lk.breedName(animal.breed_id)}
              </td>

              <td className="px-3 py-3">
                {animal.sex ? titleCase(animal.sex) : "—"}
              </td>

              <td className="px-3 py-3">
                <div>{lk.farmName(animal.farm_section_id)}</div>
                <div className="text-xs text-muted-foreground">
                  {lk.sectionName(animal.farm_section_id)}
                </div>
              </td>

              <td className="px-3 py-3 font-medium">
                {animal.estimated_value != null
                  ? formatNaira(Number(animal.estimated_value))
                  : "—"}
              </td>

              <td className="px-3 py-3">
                <StatusBadge tone={statusTone(animal.status)}>
                  {titleCase(animal.status)}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BatchTable({
  batches,
  lk,
  onSelect,
  onAdd,
}: {
  batches: BatchWithMovements[];
  lk: ReturnType<typeof makeLookups>;
  onSelect: (batch: BatchWithMovements) => void;
  onAdd: () => void;
}) {
  if (!batches.length) {
    return (
      <EmptyState
        title="No livestock batches"
        body="No poultry or other batch-tracked livestock batches have been registered yet."
        action={
          <Button onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add batch
          </Button>
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-3 font-medium">Batch</th>
            <th className="px-3 py-3 font-medium">Type</th>
            <th className="px-3 py-3 font-medium">Initial</th>
            <th className="px-3 py-3 font-medium">Current</th>
            <th className="px-3 py-3 font-medium">Mortality</th>
            <th className="px-3 py-3 font-medium">Sold</th>
            <th className="px-3 py-3 font-medium">Location</th>
            <th className="px-3 py-3 font-medium">Status</th>
          </tr>
        </thead>

        <tbody>
          {batches.map((batch) => {
            const movements = batch.batch_movements ?? [];

            const mortality = movements
              .filter((m) => m.movement_type === "mortality")
              .reduce((sum, m) => sum + m.quantity, 0);

            const sold = movements
              .filter((m) => m.movement_type === "sale")
              .reduce((sum, m) => sum + m.quantity, 0);

            return (
              <tr
                key={batch.id}
                className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                onClick={() => onSelect(batch)}
              >
                <td className="px-3 py-3 font-semibold">
                  {batch.batch_code}
                </td>

                <td className="px-3 py-3">
                  {lk.typeName(batch.livestock_type_id)}
                </td>

                <td className="px-3 py-3 tabular">
                  {batch.initial_quantity.toLocaleString()}
                </td>

                <td className="px-3 py-3 font-semibold tabular">
                  {batch.current_quantity.toLocaleString()}
                </td>

                <td className="px-3 py-3 tabular text-destructive">
                  {mortality.toLocaleString()}
                </td>

                <td className="px-3 py-3 tabular">
                  {sold.toLocaleString()}
                </td>

                <td className="px-3 py-3">
              <div>
                  {lk.farmNameById(batch.farm_id) !== "—"
                  ? lk.farmNameById(batch.farm_id)
                  : lk.farmName(batch.farm_section_id)}
              </div>
              <div className="text-xs text-muted-foreground">
                  {batch.location_description || lk.sectionName(batch.farm_section_id)}
              </div>
            </td>
                <td className="px-3 py-3">
                  <StatusBadge tone={statusTone(batch.status)}>
                    {titleCase(batch.status)}
                  </StatusBadge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export default function LivestockPage() {
  const [tab, setTab] = useState<Tab>("overview");

  const [animalDialogOpen, setAnimalDialogOpen] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);

  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const { can } = useAuth();
  
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [farmFilter, setFarmFilter] = useState("");

  const reference = useQuery(referenceQuery);
  const animals = useQuery(animalsQuery);
  const batches = useQuery(batchesQuery);

  const selectedBatch =
  (batches.data ?? []).find(
    (batch) => batch.id === selectedBatchId,
  ) ?? null;

  const refData = reference.data ?? {
    types: [],
    breeds: [],
    farms: [],
    sections: [],
  };

  const lk = useMemo(() => makeLookups(refData), [refData]);

  const stats = useMemo(
    () =>
      computeStats(
        animals.data ?? [],
        batches.data ?? [],
      ),
    [animals.data, batches.data],
  );

  const filteredAnimals = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (animals.data ?? []).filter((animal) => {
      const matchesSearch =
        !term ||
        animal.tag_number.toLowerCase().includes(term) ||
        lk.typeName(animal.livestock_type_id).toLowerCase().includes(term) ||
        lk.breedName(animal.breed_id).toLowerCase().includes(term);

      const matchesType =
        !typeFilter ||
        animal.livestock_type_id === typeFilter;

      const matchesStatus =
        !statusFilter ||
        animal.status === statusFilter;

      const animalFarmId = animal.farm_section_id
        ? lk.farmIdOf(animal.farm_section_id)
        : "";

      const matchesFarm =
        !farmFilter ||
        animalFarmId === farmFilter;

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesFarm
      );
    });
  }, [
    animals.data,
    search,
    typeFilter,
    statusFilter,
    farmFilter,
    lk,
  ]);

  const individualTypes = refData.types.filter(
    (type) =>
      type.tracking_method === "individual" &&
      type.is_active,
  );

  const batchTypes = refData.types.filter(
    (type) =>
      type.tracking_method === "batch" &&
      type.is_active,
  );

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
    setFarmFilter("");
  };

  const hasFilters =
    search ||
    typeFilter ||
    statusFilter ||
    farmFilter;

  const refresh = () => {
    void reference.refetch();
    void animals.refetch();
    void batches.refetch();
  };

  return (
    <RequirePermission perm="livestock.view">
      <PageHeader
        title="Livestock"
        description="Manage individual animals, poultry batches, values, movements and livestock records."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>

            <RequirePermission perm="livestock.manage">
              <Button
                size="sm"
                onClick={() => {
                  setEditingAnimal(null);
                  setAnimalDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add animal
              </Button>
            </RequirePermission>
          </div>
        }
      />

      <div className="space-y-6">\n        <PendingApprovalsPanel />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total livestock"
            value={stats.total.toLocaleString()}
            icon={PawPrint}
            description="Active animals and birds"
          />

          <StatCard
            label="Individual animals"
            value={stats.individuals.toLocaleString()}
            icon={Tag}
            description="Individually tracked"
          />

          <StatCard
            label="Batch livestock"
            value={stats.birds.toLocaleString()}
            icon={Bird}
            description="Current birds across batches"
          />

          <StatCard
            label="Estimated value"
            value={formatNaira(stats.value)}
            icon={DollarSign}
            description="Current estimated value"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Sold"
            value={stats.sold.toLocaleString()}
            icon={TrendingUp}
          />

          <StatCard
            label="Mortality"
            value={stats.dead.toLocaleString()}
            icon={Skull}
          />

          <StatCard
            label="Transferred"
            value={stats.transferred.toLocaleString()}
            icon={Activity}
          />
        </div>

        <div className="flex flex-wrap gap-2 border-b pb-3">
          {(
            [
              ["overview", "Overview"],
              ["animals", "Individual Animals"],
              ["batches", "Batches"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={tab === value ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab(value)}
            >
              {label}
            </Button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              title="Livestock types"
              action={
                <StatusBadge tone="info">
                  {refData.types.length} types
                </StatusBadge>
              }
            >
              {refData.types.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {refData.types.map((type) => (
                    <div
                      key={type.id}
                      className="rounded-lg border bg-background p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">
                          {type.name}
                        </span>

                        <StatusBadge
                          tone={
                            type.is_active
                              ? "success"
                              : "neutral"
                          }
                        >
                          {type.is_active
                            ? "Active"
                            : "Inactive"}
                        </StatusBadge>
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground">
                        Tracking:{" "}
                        {titleCase(type.tracking_method)}
                        {" · "}
                        Unit: {type.unit_label}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No livestock types"
                  body="Livestock types have not been configured."
                />
              )}
            </Panel>

            <Panel title="Operational summary">
              <div className="space-y-3">
                <div className="flex justify-between border-b pb-3">
                  <span className="text-muted-foreground">
                    Individual tracking types
                  </span>
                  <span className="font-semibold">
                    {individualTypes.length}
                  </span>
                </div>

                <div className="flex justify-between border-b pb-3">
                  <span className="text-muted-foreground">
                    Batch tracking types
                  </span>
                  <span className="font-semibold">
                    {batchTypes.length}
                  </span>
                </div>

                <div className="flex justify-between border-b pb-3">
                  <span className="text-muted-foreground">
                    Active animals
                  </span>
                  <span className="font-semibold">
                    {stats.individuals.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Current batch quantity
                  </span>
                  <span className="font-semibold">
                    {stats.birds.toLocaleString()}
                  </span>
                </div>
              </div>
            </Panel>

            <Panel
              title="Recent individual records"
              className="lg:col-span-2"
            >
              {animals.isLoading ? (
                <LoadingRows />
              ) : animals.error ? (
                <ErrorState
                  error={animals.error}
                  onRetry={() => void animals.refetch()}
                />
              ) : (
                <AnimalTable
                  animals={(animals.data ?? []).slice(0, 8)}
                  lk={lk}
                  onSelect={setSelectedAnimal}
                  onAdd={() => {
                    setEditingAnimal(null);
                    setAnimalDialogOpen(true);
                  }}
                />
              )}
            </Panel>
          </div>
        )}

        {tab === "animals" && (
          <Panel
            title="Individual animal register"
            action={
              <RequirePermission perm="livestock.manage">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingAnimal(null);
                    setAnimalDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add animal
                </Button>
              </RequirePermission>
            }
          >
            <div className="mb-5 flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tag, type or breed..."
                  className="pl-9"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Select
                  value={typeFilter || NONE}
                  onValueChange={(value) =>
                    setTypeFilter(
                      value === NONE ? "" : value,
                    )
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Livestock type" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value={NONE}>
                      All types
                    </SelectItem>

                    {individualTypes.map((type) => (
                      <SelectItem
                        key={type.id}
                        value={type.id}
                      >
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={statusFilter || NONE}
                  onValueChange={(value) =>
                    setStatusFilter(
                      value === NONE ? "" : value,
                    )
                  }
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value={NONE}>
                      All statuses
                    </SelectItem>
                    {[
                      "active",
                      "sold",
                      "dead",
                      "transferred",
                      "missing",
                      "quarantined",
                    ].map((status) => (
                      <SelectItem
                        key={status}
                        value={status}
                      >
                        {titleCase(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <SimpleSelect
                  value={farmFilter}
                  onChange={setFarmFilter}
                  allowNone
                  noneLabel="All farms"
                  options={refData.farms.map((farm) => ({
                    value: farm.id,
                    label: farm.name,
                  }))}
                />

                {hasFilters && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Clear filters"
                    onClick={clearFilters}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {animals.isLoading ? (
              <LoadingRows />
            ) : animals.error ? (
              <ErrorState
                error={animals.error}
                onRetry={() => void animals.refetch()}
              />
            ) : (
              <AnimalTable
                animals={filteredAnimals}
                lk={lk}
                onSelect={setSelectedAnimal}
                onAdd={() => {
                  setEditingAnimal(null);
                  setAnimalDialogOpen(true);
                }}
              />
            )}
          </Panel>
        )}

        {tab === "batches" && (
  <Panel
    title="Poultry & batch livestock"
    action={
      <div className="flex items-center gap-2">
        <StatusBadge tone="info">
          {batches.data?.length ?? 0} batches
        </StatusBadge>

        <RequirePermission perm="livestock.manage">
          <Button
            size="sm"
            onClick={() => {
              setEditingBatch(null);
              setBatchDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add batch
          </Button>
        </RequirePermission>
      </div>
    }
  >
    {batches.isLoading ? (
      <LoadingRows />
    ) : batches.error ? (
      <ErrorState
        error={batches.error}
        onRetry={() => void batches.refetch()}
      />
    ) : (
      <BatchTable
        batches={batches.data ?? []}
        lk={lk}
        onSelect={(batch) => setSelectedBatchId(batch.id)}
        onAdd={() => {
          setEditingBatch(null);
          setBatchDialogOpen(true);
        }}
      />
    )}
  </Panel>
)}

        <Panel title="Livestock data model">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Animals", "Individual animal register"],
              ["Batches", "Poultry and batch tracking"],
              ["Movements", "Mortality, sales and transfers"],
              ["Audit", "Activity history"],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-lg border bg-background p-4"
              >
                <div className="flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-primary" />
                  <span className="font-semibold">
                    {title}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <AnimalFormDialog
        open={animalDialogOpen}
        onOpenChange={setAnimalDialogOpen}
        animal={editingAnimal}
        refData={refData}
      />
      
     <BatchFormDialog
  open={batchDialogOpen}
  onOpenChange={setBatchDialogOpen}
  batch={editingBatch}
  refData={refData}
/>

<BatchDetailSheet
  batch={selectedBatch}
  onClose={() => setSelectedBatchId(null)}
  refData={refData}
  lk={lk}
  canManage={can("livestock.manage")}
/>
      
      <AnimalDetailSheet
        animal={selectedAnimal}
        onClose={() => setSelectedAnimal(null)}
        onEdit={(animal) => {
          setSelectedAnimal(null);
          setEditingAnimal(animal);
          setAnimalDialogOpen(true);
        }}
        canManage={can("livestock.manage")}
        refData={refData}
        lk={lk}
      />
    </RequirePermission>
  );
}

