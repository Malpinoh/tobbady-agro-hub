
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import {
  Users,
  UserRound,
  ShieldCheck,
  RefreshCw,
  Plus,
  Search,
  UserCog,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ALL_ROLES, ROLE_LABELS, type AppRole } from "@/lib/access";
import { PageHeader, RequirePermission } from "@/components/app/PageKit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Employee = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  hired_on: string | null;
  status: string;
  user_id: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
};

type UserRole = {
  id: string;
  user_id: string;
  role: AppRole;
};

type RolePermission = {
  role: AppRole;
  permission_key: string;
};

type Permission = {
  key: string;
  module: string;
  description: string | null;
};

type Tab = "employees" | "accounts" | "roles" | "permissions";

const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "employees", label: "Employees", icon: Users },
  { id: "accounts", label: "User Accounts", icon: UserRound },
  { id: "roles", label: "Role Assignment", icon: UserCog },
  { id: "permissions", label: "Permissions", icon: ShieldCheck },
];

export default function StaffPage() {
  const { user, can, hasRole } = useAuth();
  const queryClient = useQueryClient();

  const canManageEmployees =
    can("users.manage") || can("settings.manage");
  const canManageRoles =
    can("users.manage") || can("settings.manage");

  const [tab, setTab] = useState<Tab>("employees");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [employeeDialog, setEmployeeDialog] = useState(false);
  const [roleDialog, setRoleDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole | "">("");

  const [employeeForm, setEmployeeForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    position: "",
    hired_on: new Date().toISOString().slice(0, 10),
    status: "active",
    notes: "",
  });

  const employeesQuery = useQuery({
    queryKey: ["staff-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Employee[];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["staff-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, is_active")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const rolesQuery = useQuery({
    queryKey: ["staff-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role");
      if (error) throw error;
      return (data ?? []) as UserRole[];
    },
  });

  const permissionsQuery = useQuery({
    queryKey: ["staff-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissions")
        .select("key, module, description")
        .order("module")
        .order("key");
      if (error) throw error;
      return (data ?? []) as Permission[];
    },
  });

  const rolePermissionsQuery = useQuery({
    queryKey: ["staff-role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("role, permission_key");
      if (error) throw error;
      return (data ?? []) as RolePermission[];
    },
  });

  const employees = employeesQuery.data ?? [];
  const profiles = profilesQuery.data ?? [];
  const userRoles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];
  const rolePermissions = rolePermissionsQuery.data ?? [];

  const loading =
    employeesQuery.isLoading ||
    profilesQuery.isLoading ||
    rolesQuery.isLoading ||
    permissionsQuery.isLoading ||
    rolePermissionsQuery.isLoading;

  const errors = [
    employeesQuery.error,
    profilesQuery.error,
    rolesQuery.error,
    permissionsQuery.error,
    rolePermissionsQuery.error,
  ].filter(Boolean);

  const roleNames = (userId: string) =>
    userRoles
      .filter((item) => item.user_id === userId)
      .map((item) => ROLE_LABELS[item.role])
      .join(", ") || "No role assigned";

  const term = search.trim().toLowerCase();

  const filteredEmployees = employees.filter((employee) =>
    [
      employee.full_name,
      employee.email,
      employee.phone,
      employee.position,
      employee.status,
    ].some((value) => (value ?? "").toLowerCase().includes(term)),
  );

  const filteredProfiles = profiles.filter((profile) =>
    [
      profile.full_name,
      profile.email,
      profile.phone,
      roleNames(profile.id),
    ].some((value) => (value ?? "").toLowerCase().includes(term)),
  );

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-employees"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-profiles"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-user-roles"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-permissions"] }),
      queryClient.invalidateQueries({
        queryKey: ["staff-role-permissions"],
      }),
    ]);
  }

  function openEmployeeDialog() {
    setEmployeeForm({
      full_name: "",
      email: "",
      phone: "",
      position: "",
      hired_on: new Date().toISOString().slice(0, 10),
      status: "active",
      notes: "",
    });
    setEmployeeDialog(true);
  }

  async function saveEmployee() {
    if (!canManageEmployees) {
      alert("You do not have permission to manage employees.");
      return;
    }

    if (!employeeForm.full_name.trim()) {
      alert("Enter the employee's full name.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("employees").insert({
        full_name: employeeForm.full_name.trim(),
        email: employeeForm.email.trim() || null,
        phone: employeeForm.phone.trim() || null,
        position: employeeForm.position.trim() || null,
        hired_on: employeeForm.hired_on || null,
        status: employeeForm.status,
      });

      if (error) throw error;

      setEmployeeDialog(false);
      await refresh();
      alert("Employee record saved.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not save employee record.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function assignRole() {
    if (!canManageRoles) {
      alert("You do not have permission to assign roles.");
      return;
    }

    if (!selectedUser || !selectedRole) {
      alert("Select a user and a role.");
      return;
    }

    if (
      selectedUser.id === user?.id &&
      hasRole("ceo") &&
      selectedRole !== "ceo"
    ) {
      alert(
        "For safety, this page will not change your own CEO role. Ask another authorised administrator to manage it.",
      );
      return;
    }

    const existing = userRoles.find(
      (item) =>
        item.user_id === selectedUser.id &&
        item.role === selectedRole,
    );

    setSaving(true);

    try {
      if (existing) {
        alert("This user already has that role.");
        return;
      }

      const { error } = await supabase.from("user_roles").insert({
        user_id: selectedUser.id,
        role: selectedRole,
      });

      if (error) throw error;

      setRoleDialog(false);
      setSelectedRole("");
      await refresh();
      alert("Role assigned successfully.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not assign role. Check your permissions.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeRole(userId: string, role: AppRole) {
    if (!canManageRoles) {
      alert("You do not have permission to manage roles.");
      return;
    }

    if (userId === user?.id && hasRole("ceo")) {
      alert(
        "For safety, this page will not remove your own CEO role.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Remove the ${ROLE_LABELS[role]} role from this user?`,
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);

      if (error) throw error;

      await refresh();
      alert("Role removed.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not remove role.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequirePermission perm="staff.view">
      <div className="space-y-6">
        <PageHeader
          title="Staff & Users"
          description="Manage employee records, existing user accounts, roles and permissions."
          actions={
            <Button
              variant="outline"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          }
        />

        {errors.length > 0 && (
          <div className="rounded-lg border border-destructive/40 p-4 text-sm">
            Some staff data could not be loaded. Check your database access
            policies and permissions, then refresh the page.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Employee Records"
            value={String(employees.length)}
            icon={Users}
          />
          <SummaryCard
            title="User Accounts"
            value={String(profiles.length)}
            icon={UserRound}
          />
          <SummaryCard
            title="Active Accounts"
            value={String(profiles.filter((p) => p.is_active).length)}
            icon={ShieldCheck}
          />
          <SummaryCard
            title="Available Permissions"
            value={String(permissions.length)}
            icon={UserCog}
          />
        </div>

        <div className="flex flex-wrap gap-2 border-b pb-3">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={tab === item.id ? "default" : "outline"}
                onClick={() => {
                  setTab(item.id);
                  setSearch("");
                }}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={`Search ${tab}...`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {tab === "employees" && canManageEmployees && (
            <Button onClick={openEmployeeDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          )}
        </div>

        {loading ? (
          <div className="rounded-xl border p-10 text-center text-muted-foreground">
            Loading staff data...
          </div>
        ) : (
          <>
            {tab === "employees" && (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3">Employee</th>
                      <th className="p-3">Position</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Hire Date</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((employee) => (
                      <tr key={employee.id} className="border-t">
                        <td className="p-3 font-medium">
                          {employee.full_name}
                        </td>
                        <td className="p-3">{employee.position || "—"}</td>
                        <td className="p-3">{employee.phone || "—"}</td>
                        <td className="p-3">{employee.email || "—"}</td>
                        <td className="p-3">{employee.hired_on || "—"}</td>
                        <td className="p-3 capitalize">
                          {employee.status}
                        </td>
                      </tr>
                    ))}
                    {filteredEmployees.length === 0 && (
                      <EmptyRow
                        columns={6}
                        message="No employee records found."
                      />
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "accounts" && (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Roles</th>
                      <th className="p-3">Profile Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.map((profile) => (
                      <tr key={profile.id} className="border-t">
                        <td className="p-3 font-medium">
                          {profile.full_name || "Unnamed user"}
                          {profile.id === user?.id && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (You)
                            </span>
                          )}
                        </td>
                        <td className="p-3">{profile.email || "—"}</td>
                        <td className="p-3">{profile.phone || "—"}</td>
                        <td className="p-3">{roleNames(profile.id)}</td>
                        <td className="p-3">
                          {profile.is_active ? "Active" : "Inactive"}
                        </td>
                      </tr>
                    ))}
                    {filteredProfiles.length === 0 && (
                      <EmptyRow
                        columns={5}
                        message="No user profiles found."
                      />
                    )}
                  </tbody>
                </table>
                <p className="border-t p-3 text-xs text-muted-foreground">
                  This list shows existing profiles in the application. It
                  does not create login accounts or change account status.
                </p>
              </div>
            )}

            {tab === "roles" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Assign an application role to an existing user account.
                  Only assign roles appropriate to each person's duties.
                </p>
                {profiles.map((profile) => {
                  const assignedRoles = userRoles.filter(
                    (item) => item.user_id === profile.id,
                  );

                  return (
                    <div
                      key={profile.id}
                      className="flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {profile.full_name || "Unnamed user"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {profile.email || profile.id}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {assignedRoles.length > 0 ? (
                            assignedRoles.map((item) => (
                              <span
                                key={item.id}
                                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
                              >
                                {ROLE_LABELS[item.role]}
                                {canManageRoles && (
                                  <button
                                    type="button"
                                    disabled={saving}
                                    className="font-bold text-destructive"
                                    title={`Remove ${ROLE_LABELS[item.role]} role`}
                                    onClick={() =>
                                      void removeRole(profile.id, item.role)
                                    }
                                  >
                                    ×
                                  </button>
                                )}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              No role assigned
                            </span>
                          )}
                        </div>
                      </div>

                      {canManageRoles && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedUser(profile);
                            setSelectedRole("");
                            setRoleDialog(true);
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Assign Role
                        </Button>
                      )}
                    </div>
                  );
                })}
                {profiles.length === 0 && (
                  <div className="rounded-xl border p-8 text-center text-muted-foreground">
                    No user profiles are available.
                  </div>
                )}
              </div>
            )}

            {tab === "permissions" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  These are the permissions configured in the database and
                  the roles currently associated with them. This page views
                  permissions; it does not edit the permission rules.
                </p>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3">Module</th>
                        <th className="p-3">Permission</th>
                        <th className="p-3">Assigned Roles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permissions
                        .filter((permission) =>
                          `${permission.module} ${permission.key} ${permission.description ?? ""}`
                            .toLowerCase()
                            .includes(term),
                        )
                        .map((permission) => {
                          const assigned = rolePermissions
                            .filter(
                              (rp) => rp.permission_key === permission.key,
                            )
                            .map((rp) => ROLE_LABELS[rp.role]);

                          return (
                            <tr key={permission.key} className="border-t">
                              <td className="p-3 capitalize">
                                {permission.module}
                              </td>
                              <td className="p-3">
                                <p className="font-medium">
                                  {permission.key}
                                </p>
                                {permission.description && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {permission.description}
                                  </p>
                                )}
                              </td>
                              <td className="p-3">
                                {assigned.join(", ") || "No roles assigned"}
                              </td>
                            </tr>
                          );
                        })}
                      {permissions.filter((permission) =>
                        `${permission.module} ${permission.key} ${permission.description ?? ""}`
                          .toLowerCase()
                          .includes(term),
                      ).length === 0 && (
                        <EmptyRow
                          columns={3}
                          message="No permissions found."
                        />
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        <Dialog open={employeeDialog} onOpenChange={setEmployeeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Employee</DialogTitle>
              <DialogDescription>
                Create an employee record. This does not create a login
                account.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
              <Field label="Full name *">
                <Input
                  value={employeeForm.full_name}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      full_name: e.target.value,
                    })
                  }
                  placeholder="Employee's full name"
                />
              </Field>
              <Field label="Position">
                <Input
                  value={employeeForm.position}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      position: e.target.value,
                    })
                  }
                  placeholder="e.g. Farm Worker"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={employeeForm.email}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      email: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={employeeForm.phone}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      phone: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Hire date">
                <Input
                  type="date"
                  value={employeeForm.hired_on}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      hired_on: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Employment status">
                <Select
                  value={employeeForm.status}
                  onValueChange={(value) =>
                    setEmployeeForm({
                      ...employeeForm,
                      status: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On leave</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Notes">
                <Textarea
                  value={employeeForm.notes}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Optional notes"
                />
              </Field>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEmployeeDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void saveEmployee()}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Employee"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Role</DialogTitle>
              <DialogDescription>
                {selectedUser?.full_name || selectedUser?.email}
              </DialogDescription>
            </DialogHeader>

            <Field label="Application role">
              <Select
                value={selectedRole}
                onValueChange={(value) =>
                  setSelectedRole(value as AppRole)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.filter(
                    (role) =>
                      !userRoles.some(
                        (item) =>
                          item.user_id === selectedUser?.id &&
                          item.role === role,
                      ),
                  ).map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <p className="text-xs text-muted-foreground">
              Role changes can grant access to sensitive farm and financial
              information. Assign roles carefully.
            </p>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRoleDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void assignRole()}
                disabled={saving || !selectedRole}
              >
                {saving ? "Saving..." : "Assign Role"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RequirePermission>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{title}</p>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="mt-3 text-xl font-bold">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function EmptyRow({
  columns,
  message,
}: {
  columns: number;
  message: string;
}) {
  return (
    <tr>
      <td
        colSpan={columns}
        className="p-8 text-center text-muted-foreground"
      >
        {message}
      </td>
    </tr>
  );
}

