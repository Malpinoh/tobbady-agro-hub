import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, Hammer, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-card", className)}>
      {title && (
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const tones = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
  info: "bg-info-soft text-info",
  neutral: "bg-muted text-muted-foreground",
} as const;
export type Tone = keyof typeof tones;

export function StatusBadge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", tones[tone])}>{children}</span>;
}

export function DemoTag() {
  return <span className="rounded bg-gold-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold-foreground">Demo data</span>;
}

/** Blocks page content unless the user has the given permission. */
export function RequirePermission({ perm, children }: { perm: string; children: ReactNode }) {
  const { can, loading } = useAuth();
  if (loading) return null;
  if (!can(perm)) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-xl border bg-card p-8 text-center shadow-card">
        <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">Access restricted</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your role doesn't include access to this section. Contact an administrator if you need it.</p>
        <Button asChild variant="outline" className="mt-6"><Link to="/settings">Go to settings</Link></Button>
      </div>
    );
  }
  return <>{children}</>;
}

export function ComingSoon({ icon: Icon = Hammer, title, items }: { icon?: LucideIcon; title: string; items: string[] }) {
  return (
    <Panel>
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{title}</h3>
            <StatusBadge tone="warning">Coming in a later stage</StatusBadge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">The data structure for this module is ready. Planned capabilities:</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {items.map((i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" />{i}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

/** Standard module page: permission gate + header + coming-soon body. */
export function ModulePage({ perm, title, description, icon, planned, children }: {
  perm: string; title: string; description: string; icon?: LucideIcon; planned: string[]; children?: ReactNode;
}) {
  return (
    <RequirePermission perm={perm}>
      <PageHeader title={title} description={description} />
      <div className="space-y-6">
        {children}
        <ComingSoon icon={icon} title={`${title} module`} items={planned} />
      </div>
    </RequirePermission>
  );
}
