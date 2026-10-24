import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Panel, StatusBadge } from "@/components/app/PageKit";
import { formatValue } from "@/components/app/ApprovalDetails";

export function MortalityRequestStatus() {
  const { user, hasRole } = useAuth();
  const enabled = !!user && hasRole("secretary");
  const query = useQuery({
    queryKey: ["mortality-request-status", user?.id], enabled, refetchInterval: 30_000,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("record_change_requests")
        .select("id, record_label, mortality_quantity, death_on, reason, status, requested_at, reviewed_at, rejection_reason")
        .eq("requested_by", user.id).not("mortality_quantity", "is", null).order("requested_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!enabled) return null;
  return <Panel title="My mortality requests">
    {query.isLoading ? <p className="text-sm text-muted-foreground">Loading requests…</p>
      : query.isError ? <p role="alert" className="text-sm text-destructive">Unable to load request status. {query.error.message}</p>
      : !query.data?.length ? <p className="text-sm text-muted-foreground">No mortality requests submitted.</p>
      : <div className="divide-y">{query.data.map((request) => <div key={request.id} className="flex flex-wrap justify-between gap-3 py-3">
        <div><p className="font-medium">{request.record_label} · {request.mortality_quantity?.toLocaleString()} deaths</p>
          <p className="text-sm text-muted-foreground">{formatValue("death_on", request.death_on)} · {request.reason}</p>
          <p className="text-xs text-muted-foreground">Submitted {formatValue("requested_at", request.requested_at)}</p>
          {request.rejection_reason && <p className="text-sm text-destructive">Rejection reason: {request.rejection_reason}</p>}
        </div><StatusBadge tone={request.status === "approved" ? "success" : request.status === "rejected" ? "danger" : "warning"}>{request.status}</StatusBadge>
      </div>)}</div>}
  </Panel>;
}