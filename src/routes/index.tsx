import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ShieldCheck, Beef, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/app/Brand";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TOBADDY AGRO LIVESTOCK — Management System" },
      { name: "description", content: "Secure staff portal for livestock, finance, sales and operations at TOBADDY AGRO LIVESTOCK." },
      { property: "og:title", content: "TOBADDY AGRO LIVESTOCK — Management System" },
      { property: "og:description", content: "Secure staff portal for livestock, finance, sales and operations." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <Brand />
          <Button asChild variant="secondary"><Link to="/auth">Staff sign in</Link></Button>
        </header>
        <main className="flex flex-1 flex-col justify-center py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sidebar-primary">Management System</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">
            TOBADDY AGRO LIVESTOCK
          </h1>
          <p className="mt-5 max-w-xl text-lg text-sidebar-muted">
            One secure workspace for livestock, finance, sales, inventory and staff with role-based access for every team member.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90"><Link to="/auth">Sign in to continue</Link></Button>
          </div>
          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Beef, t: "Individual & batch tracking", d: "Cattle, goats and sheep by tag. Poultry by batch." },
              { icon: ShieldCheck, t: "Role-based access", d: "Eight roles, each seeing only what they need." },
              { icon: BarChart3, t: "Full audit trail", d: "Every important change is traceable." },
            ].map((f) => (
              <div key={f.t} className="rounded-xl border border-sidebar-border bg-sidebar-accent p-5">
                <f.icon className="h-5 w-5 text-sidebar-primary" />
                <div className="mt-3 font-semibold">{f.t}</div>
                <div className="mt-1 text-sm text-sidebar-muted">{f.d}</div>
              </div>
            ))}
          </div>
        </main>
        <footer className="text-xs text-sidebar-muted">© {new Date().getFullYear()} TOBADDY AGRO LIVESTOCK</footer>
      </div>
    </div>
  );
}
