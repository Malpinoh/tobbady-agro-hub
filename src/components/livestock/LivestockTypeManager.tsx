import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  livestockCategoriesQuery,
  livestockKeys,
  referenceQuery,
  slugify,
  type LivestockCategory,
  type LivestockType,
} from "@/lib/livestock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

type TypeForm = {
  name: string;
  category_id: string;
  tracking_method: "individual" | "batch";
  unit_label: string;
  sort_order: string;
};

const emptyForm: TypeForm = {
  name: "",
  category_id: "",
  tracking_method: "individual",
  unit_label: "head",
  sort_order: "0",
};

export default function LivestockTypeManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TypeForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reference = useQuery(referenceQuery);
  const categoriesQuery = useQuery(livestockCategoriesQuery);

  const types = reference.data?.types ?? [];
  const categories: LivestockCategory[] = categoriesQuery.data ?? [];

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      const slug = slugify(name);

      if (!name) throw new Error("Enter a livestock type name.");
      if (!slug) throw new Error("Enter a valid livestock type name.");
      if (!form.category_id) throw new Error("Select a category.");
      if (!form.unit_label.trim()) throw new Error("Enter a unit label.");

      const payload = {
        name,
        slug,
        category_id: form.category_id,
        tracking_method: form.tracking_method,
        unit_label: form.unit_label.trim(),
        sort_order: Number.isFinite(Number(form.sort_order))
          ? Number(form.sort_order)
          : 0,
      };

      if (editingId) {
        const { error } = await supabase
          .from("livestock_types")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("livestock_types")
          .insert(payload);

        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...livestockKeys.all, "reference"],
      });
      toast.success(editingId ? "Livestock type updated." : "Livestock type added.");
      setForm(emptyForm);
      setEditingId(null);
    },
    onError: (error) => {
      toast.error(error.message || "Could not save livestock type.");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (type: LivestockType) => {
      const { error } = await supabase
        .from("livestock_types")
        .update({ is_active: !type.is_active })
        .eq("id", type.id);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...livestockKeys.all, "reference"],
      });
      toast.success("Livestock type status updated.");
    },
    onError: (error) => {
      toast.error(error.message || "Could not update livestock type status.");
    },
  });

  function startEditing(type: LivestockType) {
    setEditingId(type.id);
    setForm({
      name: type.name,
      category_id: type.category_id ?? "",
      tracking_method: type.tracking_method,
      unit_label: type.unit_label || "head",
      sort_order: String(type.sort_order ?? 0),
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <div className="space-y-6">
      <Panel>
        <div className="space-y-4 p-4">
          <div>
            <h2 className="text-lg font-semibold">Livestock Types</h2>
            <p className="text-sm text-muted-foreground">
              Add and manage the animals your farm tracks. Existing types can be
              edited or deactivated without deleting their records.
            </p>
          </div>

          {categoriesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading categories...</p>
          ) : categoriesQuery.isError ? (
            <p className="text-sm text-destructive">
              Could not load categories. Refresh the page and try again.
            </p>
          ) : categories.filter((category) => category.is_active).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add and activate a category above before creating a livestock type.
            </p>
          ) : (
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                saveMutation.mutate();
              }}
            >
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="livestock-type-name">
                  Type name
                </label>
                <Input
                  id="livestock-type-name"
                  placeholder="e.g. Cow, Goat, Broiler"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="livestock-type-category">
                  Category
                </label>
                <Select
                  value={form.category_id}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, category_id: value }))
                  }
                >
                  <SelectTrigger id="livestock-type-category">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter((category) => category.is_active)
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="livestock-tracking">
                  Tracking method
                </label>
                <Select
                  value={form.tracking_method}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      tracking_method: value as "individual" | "batch",
                    }))
                  }
                >
                  <SelectTrigger id="livestock-tracking">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual animal</SelectItem>
                    <SelectItem value="batch">Batch/group</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="livestock-unit">
                  Unit label
                </label>
                <Input
                  id="livestock-unit"
                  placeholder="e.g. head, birds"
                  value={form.unit_label}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      unit_label: event.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="livestock-sort-order">
                  Display order
                </label>
                <Input
                  id="livestock-sort-order"
                  type="number"
                  value={form.sort_order}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sort_order: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending
                    ? "Saving..."
                    : editingId
                      ? "Update type"
                      : "Add type"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={cancelEditing}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>
      </Panel>

      <Panel>
        <div className="space-y-4 p-4">
          <h3 className="font-semibold">Existing Livestock Types</h3>

          {reference.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading livestock types...</p>
          ) : reference.isError ? (
            <p className="text-sm text-destructive">
              Could not load livestock types. Refresh the page and try again.
            </p>
          ) : types.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No livestock types have been added yet.
            </p>
          ) : (
            <div className="space-y-3">
              {types.map((type) => (
                <div
                  key={type.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{type.name}</span>
                      <StatusBadge status={type.is_active ? "active" : "inactive"} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {categoryNames.get(type.category_id ?? "") ?? "Uncategorised"}
                      {" · "}
                      {type.tracking_method === "batch" ? "Batch/group" : "Individual"}
                      {" · "}
                      {type.unit_label}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => startEditing(type)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={toggleMutation.isPending}
                      onClick={() => toggleMutation.mutate(type)}
                    >
                      {type.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
