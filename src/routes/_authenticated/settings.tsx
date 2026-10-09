
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  KeyRound,
  PawPrint,
  UserRound,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/access";
import {
  PageHeader,
  Panel,
  RequirePermission,
  StatusBadge,
} from "@/components/app/PageKit";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — TOBADDY AGRO LIVESTOCK" },
      {
        name: "description",
        content: "System configuration and your profile.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, roles } = useAuth();

  return (
    <RequirePermission perm="settings.view">
      <PageHeader
        title="Settings"
        description="System configuration and your profile."
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
                <StatusBadge tone="info">
                  Signed-in account
                </StatusBadge>
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
            Profile editing will be enabled in a later stage.
            These details are read-only for now.
          </p>
        </Panel>

        <div className="grid gap-4 md:grid-cols-2">
          <SettingsFeature
            icon={Building2}
            title="Business Profile"
            description="Set up the farm's official name, contact details, address and business information."
          />

          <SettingsFeature
            icon={PawPrint}
            title="Livestock Types"
            description="Configure the livestock categories used throughout the farm records."
          />

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
                  <StatusBadge tone="warning">
                    Coming later
                  </StatusBadge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Update your display name and other personal account details.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Current system roles:{" "}
              {ALL_ROLES.map((role) => ROLE_LABELS[role]).join(", ")}.
            </div>
          </Panel>
        </div>
      </div>
    </RequirePermission>
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
          <p className="mt-2 text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </Panel>
  );
}
