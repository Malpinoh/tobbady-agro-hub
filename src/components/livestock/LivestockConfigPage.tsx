import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, RefreshCw, Tags } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  livestockCategoriesQuery,
  livestockKeys,
  slugify,
  type LivestockCategory,
} from "@/lib/livestock";
import {
  PageHeader,
  Panel,
  RequirePermission,
  StatusBadge,
} from "@/components/app/PageKit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import LivestockTypeManager from "./LivestockTypeManager";

export default function LivestockConfigPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can("livestock.config.manage");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<LivestockCategory | null>(null);

  const categoriesQuery = useQuery(livestockCategoriesQuery);
  const categories = categoriesQuery.data ?? [];

  const refreshCategories = async () => {
    await queryClient.invalidateQueries({
      queryKey: [...livestockKeys.all, "categories"],
    });
  };

  const saveCategory = useMutation({
    mutationFn: async () => {
      const cleanName = name.trim();

      if (!cleanName) {
        throw new Error("Enter a category name.");
      }

      const values = {
        name: cleanName,
        slug: slugify(cleanName),
        description: description.trim() || null,
      };

      if (!values.slug) {
        throw new Error("Enter a valid category name.");
      }

      const result = editing
        ? await supabase
            .from("livestock_categories")
            .update(values)
            .eq("id", editing.id)
        : await supabase
            .from("livestock_categories")
            .insert(values);

      if (result.error) {
        throw new Error(result.error.message);
      }
    },
    onSuccess: async () => {
      toast.success(editing ? "Category updated." : "Category added.");
      setName("");
      setDescription("");
      setEditing(null);
      await refreshCategories();
    },
    onError: (error) => toast.error(error.message),
  });

  const toggleCategory = useMutation({
    mutationFn: async (category: LivestockCategory) => {
      const { error } = await supabase
        .from("livestock_categories")
        .update({ is_active: !category.is_active })
        .eq("id", category.id);

      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Category status updated.");
      await refreshCategories();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteCategory = useMutation({
    mutationFn: async (category: LivestockCategory) => {
      const { error } = await supabase
        .from("livestock_categories")
        .delete()
        .eq("id", category.id);

      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Category deleted.");
      await refreshCategories();
    },
    onError: (error) => {
      toast.error(
        `Could not delete category. It may still be linked to livestock types. ${error.message}`,
      );
    },
  });

  const startEditing = (category: LivestockCategory) => {
    setEditing(category);
    setName(category.name);
    setDescription(category.description ?? "");
  };

  const cancelEditing = () => {
    setEditing(null);
    setName("");
    setDescription("");
  };

  return (
    <RequirePermission perm="livestock.config.manage">
      <PageHeader
        title="Livestock Configuration"
        description="Manage the categories used to organize your farm's livestock."
        actions={
          <Button
            variant="outline"
            onClick={() => void categoriesQuery.refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {canManage && (
          <Panel title={editing ? "Edit category" : "Add a category"}>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveCategory.mutate();
              }}
            >
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Category name *
                </label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Poultry"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The category identifier is generated from this name.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Description
                </label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe the livestock included in this category."
                  rows={4}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saveCategory.isPending}>
                  <Plus className="mr-2 h-4 w-4" />
                  {saveCategory.isPending
                    ? "Saving..."
                    : editing
                      ? "Save changes"
                      : "Add category"}
                </Button>

                {editing && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelEditing}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Panel>
        )}

        <Panel title={`Livestock categories (${categories.length})`}>
          {categoriesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading categories...
            </p>
          ) : categoriesQuery.error ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">
                Could not load categories: {categoriesQuery.error.message}
              </p>
              <Button
                variant="outline"
                onClick={() => void categoriesQuery.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : categories.length === 0 ? (
            <div className="py-8 text-center">
              <Tags className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No categories found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a category to begin organizing livestock types.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="rounded-lg border bg-background p-4"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{category.name}</h3>
                        <StatusBadge
                          tone={category.is_active ? "success" : "neutral"}
                        >
                          {category.is_active ? "Active" : "Inactive"}
                        </StatusBadge>
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        ID: {category.slug}
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {category.description || "No description provided."}
                      </p>
                    </div>

                    {canManage && (
                      <div className="flex shrink-0 flex-wrap gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${category.name}`}
                          onClick={() => startEditing(category)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={toggleCategory.isPending}
                          onClick={() => toggleCategory.mutate(category)}
                        >
                          {category.is_active ? "Deactivate" : "Activate"}
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${category.name}`}
                          disabled={deleteCategory.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete "${category.name}"? This cannot be undone.`,
                              )
                            ) {
                              deleteCategory.mutate(category);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-8">
        <LivestockTypeManager />
      </div>
    </RequirePermission>
  );
}
