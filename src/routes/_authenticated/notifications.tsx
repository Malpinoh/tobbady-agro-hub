
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertTriangle,
  Info,
  Megaphone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader, RequirePermission } from "@/components/app/PageKit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — TOBADDY AGRO LIVESTOCK" },
      {
        name: "description",
        content: "Alerts and messages for your role.",
      },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["notifications", user?.id, roles],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, title, body, severity, target_role, user_id, read_at, link, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      return (data ?? []).filter(
        (item) =>
          item.user_id === user?.id ||
          (item.user_id === null &&
            (item.target_role === null ||
              roles.includes(item.target_role))),
      );
    },
  });

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter(
    (item) => !item.read_at,
  ).length;

  async function markAsRead(id: string) {
    const item = notifications.find((notification) => notification.id === id);

    // Personal notifications can be marked read individually.
    // Role-wide notifications need a per-user read-receipt design.
    if (!item || item.user_id !== user?.id || item.read_at) return;

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      window.alert(`Could not mark notification as read: ${error.message}`);
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ["notifications"],
    });
  }

  const severityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
      case "error":
      case "urgent":
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case "announcement":
        return <Megaphone className="h-5 w-5 text-primary" />;
      default:
        return <Info className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <RequirePermission perm="notifications.view">
      <div className="space-y-6">
        <PageHeader
          title="Notifications"
          description="Alerts and messages for your role."
          actions={
            <Button
              variant="outline"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ["notifications"],
                })
              }
              disabled={notificationsQuery.isFetching}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Total Notifications</p>
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-3 text-2xl font-bold">
              {notifications.length}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Unread</p>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-3 text-2xl font-bold">{unreadCount}</p>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Read</p>
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-3 text-2xl font-bold">
              {notifications.length - unreadCount}
            </p>
          </div>
        </div>

        {notificationsQuery.isError && (
          <div className="rounded-lg border border-destructive/40 p-4 text-sm">
            Notifications could not be loaded. Check your database access
            policies and try refreshing.
          </div>
        )}

        {notificationsQuery.isLoading ? (
          <div className="rounded-xl border p-10 text-center text-muted-foreground">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-xl border p-10 text-center">
            <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">You’re all caught up</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              New alerts and announcements will appear here when available.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <div className="border-b p-4">
              <h2 className="font-semibold">Recent Notifications</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your personal notifications and alerts for your assigned role.
              </p>
            </div>

            <div className="divide-y">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className={`flex gap-3 p-4 ${
                    !item.read_at ? "bg-muted/30" : ""
                  }`}
                >
                  <div className="mt-1 shrink-0">
                    {severityIcon(item.severity)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{item.title}</h3>
                      {!item.read_at && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          Unread
                        </span>
                      )}
                      {item.target_role && (
                        <span className="rounded-full border px-2 py-0.5 text-xs capitalize">
                          {item.target_role.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>

                    {item.body && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {item.body}
                      </p>
                    )}

                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleString()}
                      {" · "}
                      {item.severity}
                    </p>

                    {item.link && (
                      <a
                        href={item.link}
                        className="mt-2 inline-block text-sm font-medium text-primary underline"
                      >
                        View details
                      </a>
                    )}

                    {!item.read_at && item.user_id === user?.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => void markAsRead(item.id)}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Mark as read
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">Notifications module</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This page reads existing notifications from the database. Approval
            requests, announcement publishing, and individual read receipts
            for role-wide alerts require their respective workflows and
            database policies.
          </p>
        </div>
      </div>
    </RequirePermission>
  );
}
