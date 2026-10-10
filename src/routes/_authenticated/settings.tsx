
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  KeyRound,
  PawPrint,
  UserRound,
  Mail,
  ShieldCheck,
  Plus,
  Pencil,
  X,
  RefreshCw,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/access";
import { slugify, friendlyError } from "@/lib/livestock";
import {
  PageHeader,
  Panel,
  RequirePermission,
  StatusBadge,
} from "@/components/app/PageKit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — TOBADDY AGRO LIVESTOCK" },
      {
        name: "description",
        content: "Manage farm settings, livestock types and your profile.",
      },
    ],
  }),
  component: SettingsPage,
});

type TrackingMethod = "individual" | "batch";

type TypeForm = {
  name: string;
  category_id: string;
  tracking_method: TrackingMethod;
  unit_label: string;
};

const emptyForm: TypeForm = {
  name: "",
  category_id: "",
  tracking_method: "individual",
  unit_label: "head",
};

function SettingsPage() {
  const { user, profile, roles, can } = useAuth();
  const queryClient = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TypeForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const typesQuery = useQuery({
    queryKey: ["settings", "livestock-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("livestock_types")
        .select("*")
        .order("sort_order")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["settings", "livestock-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("livestock_categories")
        .select("*")
        .order("sort_order")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      const slug = slugify(name);

      if (!name) throw new Error("Enter a livestock type name.");
      if (!slug) throw new Error("Enter a valid livestock type name.");
      if (!form.unit_label.trim()) {
        throw new Error("Enter a unit label, such as head or birds.");
      }

      const payload = {
        name,
        slug,
        category_id: form.category_id || null,
        tracking_method: form.tracking_method,
        unit_label: form.unit_label.trim(),
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
        queryKey: ["settings", "livestock-types"],
      });
      await queryClient.invalidateQueries({ queryKey: ["livestock"] });
      setForm(emptyForm);
      setEditingId(null);
      setFormOpen(false);
      setMessage("Livestock type saved successfully.");
    },
    onError: (error) => setMessage(friendlyError(error)),
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      active,
    }: {
      id: string;
      active: boolean;
    }) => {
      const { error } = await supabase
        .from("livestock_types")
        .update({ is_active: active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["settings", "livestock-types"],
      });
      await queryClient.invalidateQueries({ queryKey: ["livestock"] });
      setMessage("Livestock type status updated.");
    },
    onError: (error) => setMessage(friendlyError(error)),
  });

  const types = (typesQuery.data ?? []).filter((type) => {
    const matchesSearch = type.name
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    return matchesSearch && (showInactive || type.is_active);
  });

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setFormOpen(true);
  }

  function startEdit(type: NonNullable<typeof typesQuery.data>[number]) {
    setEditingId(type.id);
    setForm({
      name: type.name,
      category_id: type.category_id ?? "",
      tracking_method: type.tracking_method,
      unit_label: type.unit_label,
    });
    setMessage("");
    setFormOpen(true);
  }

  function cancelForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
  }

  return (
    <RequirePermission perm="settings.view">
      <PageHeader
        title="Settings"
        description="Manage farm configuration, livestock types and your profile."
      />

      <div className="space-y-6">
        <Panel>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <UserRound className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">My Profile</h2>
                <StatusBadge tone="info">Signed-in account</StatusBadge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Your account details and assigned access roles.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-background p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserRound className="h-4 w-4" /> Full name
              </div>
              <p className="mt-2 break-words font-medium">
                {profile?.full_name || "Name not set"}
              </p>
            </div>

            <div className="rounded-lg border bg-background p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" /> Email address
              </div>
              <p className="mt-2 break-words font-medium">
                {profile?.email || user?.email || "Email unavailable"}
              </p>
            </div>

            <div className="rounded-lg border bg-background p-4 sm:col-span-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4" /> Assigned role
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {roles.length ? (
                  roles.map((role) => (
                    <StatusBadge key={role} tone="neutral">
                      {ROLE_LABELS[role]}
                    </StatusBadge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No role assigned
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Profile details are currently read-only.
          </p>
        </Panel>

        <Panel
          title="Livestock Types"
          action={
            <Button
              size="sm"
              onClick={startAdd}
              disabled={!can("settings.manage")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Type
            </Button>
          }
        >
          <p className="mb-4 text-sm text-muted-foreground">
            Configure the types used by individual animal records and livestock
            batches. Deactivating a type preserves existing records.
          </p>

          {!can("settings.manage") && (
            <div className="mb-4 rounded-lg border p-3 text-sm text-muted-foreground">
              You can view livestock types, but you need settings management
              permission to add, edit or deactivate them.
            </div>
          )}

          {message && (
            <div
              role="status"
              className="mb-4 rounded-lg border bg-muted/40 p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span>{message}</span>
                <button
                  type="button"
                  aria-label="Dismiss message"
                  onClick={() => setMessage("")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {formOpen && (
            <form
              className="mb-6 space-y-4 rounded-xl border bg-muted/20 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (can("settings.manage")) saveMutation.mutate();
              }}
            >
              <h3 className="font-semibold">
                {editingId ? "Edit livestock type" : "Add livestock type"}
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Type name *</span>
                  <Input
                    required
                    value={form.name}
                    placeholder="e.g. Cow, Goat, Broilers"
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                  />
                </label>

                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Category</span>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={form.category_id}
                    onChange={(event) =>
                      setForm({ ...form, category_id: event.target.value })
                    }
                  >
                    <option value="">No category selected</option>
                    {(categoriesQuery.data ?? [])
                      .filter((category) => category.is_active)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                  {categoriesQuery.isError && (
                    <span className="text-xs text-destructive">
                      Categories could not be loaded. You can still save
                      without selecting a category.
                    </span>
                  )}
                </label>

                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Tracking method *</span>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={form.tracking_method}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        tracking_method: event.target.value as TrackingMethod,
                        unit_label:
                          event.target.value === "batch" ? "birds" : "head",
                      })
                    }
                  >
                    <option value="individual">Individual animal</option>
                    <option value="batch">Batch / group</option>
                  </select>
                  <span className="text-xs text-muted-foreground">
                    Individual tracks each animal separately. Batch tracks a
                    group by quantity.
                  </span>
                </label>

                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Unit label *</span>
                  <Input
                    required
                    value={form.unit_label}
                    placeholder="e.g. head or birds"
                    onChange={(event) =>
                      setForm({ ...form, unit_label: event.target.value })
                    }
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending
                    ? "Saving..."
                    : editingId
                      ? "Save Changes"
                      : "Create Type"}
                </Button>
                <Button type="button" variant="outline" onClick={cancelForm}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <Input
              value={search}
              placeholder="Search livestock types..."
              onChange={(event) => setSearch(event.target.value)}
            />

            <label className="flex shrink-0 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
              />
              Show inactive types
            </label>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void typesQuery.refetch();
                void categoriesQuery.refetch();
              }}
              disabled={typesQuery.isFetching}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          {typesQuery.isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading livestock types...
            </p>
          ) : typesQuery.isError ? (
            <div className="rounded-lg border p-4 text-sm">
              <p className="font-medium">Could not load livestock types.</p>
              <p className="mt-1 text-muted-foreground">
                {friendlyError(typesQuery.error)}
              </p>
              <Button
                className="mt-3"
                variant="outline"
                size="sm"
                onClick={() => void typesQuery.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : types.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <PawPrint className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No livestock types found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try another search or add a livestock type.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-3 font-medium">Name</th>
                    <th className="px-3 py-3 font-medium">Tracking</th>
                    <th className="px-3 py-3 font-medium">Unit</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((type) => (
                    <tr key={type.id} className="border-b last:border-0">
                      <td className="px-3 py-3">
                        <div className="font-semibold">{type.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {type.slug}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {type.tracking_method === "individual"
                          ? "Individual"
                          : "Batch / group"}
                      </td>
                      <td className="px-3 py-3">{type.unit_label}</td>
                      <td className="px-3 py-3">
                        <StatusBadge
                          tone={type.is_active ? "success" : "neutral"}
                        >
                          {type.is_active ? "Active" : "Inactive"}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-3">
                        {can("settings.manage") ? (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEdit(type)}
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={statusMutation.isPending}
                              onClick={() => {
                                setMessage("");
                                statusMutation.mutate({
                                  id: type.id,
                                  active: !type.is_active,
                                });
                              }}
                            >
                              {type.is_active ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            View only
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            Existing animals and batches are not deleted when a type is
            deactivated. Inactive types are hidden from this list unless you
            enable “Show inactive types”.
          </p>
        </Panel>

        <div className="grid gap-4 md:grid-cols-2">
          <BusinessProfileSection />

          <SettingsFeature
            icon={KeyRound}
            title="Role Permissions"
            description="Review and manage which modules each staff role can access."
          />

          <Panel className="h-full">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">Profile Management</h3>
                  <StatusBadge tone="warning">Coming later</StatusBadge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Update your display name and personal account details.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              System roles:{" "}
              {ALL_ROLES.map((role) => ROLE_LABELS[role]).join(", ")}.
            </div>
          </Panel>
        </div>
      </div>
    </RequirePermission>
  );
}


function BusinessProfileSection() {
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    location: "",
    notes: "",
  });
  const [message, setMessage] = useState("");

  const farmQuery = useQuery({
    queryKey: ["settings", "business-profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farms")
        .select("id, name, location, notes")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (farmQuery.data) {
      setForm({
        name: farmQuery.data.name ?? "",
        location: farmQuery.data.location ?? "",
        notes: farmQuery.data.notes ?? "",
      });
    }
  }, [farmQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const farm = farmQuery.data;

      if (!farm) {
        throw new Error("No existing farm record was found.");
      }

      const name = form.name.trim();
      const location = form.location.trim();
      const notes = form.notes.trim();

      if (!name) {
        throw new Error("Enter the official farm name.");
      }

      const { error } = await supabase
        .from("farms")
        .update({
          name,
          location: location || null,
          notes: notes || null,
        })
        .eq("id", farm.id);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["settings", "business-profile"],
      });
      setMessage("Business profile saved successfully.");
    },
    onError: (error) => setMessage(friendlyError(error)),
  });

  return (
    <Panel className="h-full">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold">Business Profile</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the farm's official name, location and business notes.
          </p>
        </div>
      </div>

      {farmQuery.isPending ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Loading business profile...
        </p>
      ) : farmQuery.isError ? (
        <div className="mt-4 rounded-lg border p-3 text-sm">
          <p>Could not load the business profile.</p>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            onClick={() => void farmQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : !farmQuery.data ? (
        <p className="mt-4 rounded-lg border p-3 text-sm text-muted-foreground">
          No farm record was found. No new farm has been created.
        </p>
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage("");

            if (can("farm.manage")) {
              saveMutation.mutate();
            }
          }}
        >
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Official farm name *</span>
            <Input
              required
              disabled={!can("farm.manage")}
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Farm location / address</span>
            <Input
              disabled={!can("farm.manage")}
              placeholder="Enter the farm location"
              value={form.location}
              onChange={(event) =>
                setForm({ ...form, location: event.target.value })
              }
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Business notes / description</span>
            <textarea
              disabled={!can("farm.manage")}
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Add information about the farm"
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
            />
          </label>

          {!can("farm.manage") && (
            <p className="text-xs text-muted-foreground">
              You can view this profile, but only the CEO or Administrator
              with farm management permission can edit it.
            </p>
          )}

          {message && (
            <p role="status" className="rounded-lg border p-3 text-sm">
              {message}
            </p>
          )}

          {can("farm.manage") && (
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save Business Profile"}
            </Button>
          )}
        </form>
      )}
    </Panel>
  );
}

function SettingsFeature({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
}) {
  return (
    <Panel className="h-full">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{title}</h3>
            <StatusBadge tone="warning">Coming later</StatusBadge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </Panel>
  );
}
