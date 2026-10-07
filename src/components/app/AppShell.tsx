import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Bell, LogOut, Menu } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Brand } from "./Brand";
import { NAV_GROUPS, NAV_ITEMS } from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/access";
import { useAuth } from "@/hooks/use-auth";

function SidebarNav({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { can } = useAuth();
  const items = NAV_ITEMS.filter((i) => can(i.permission));
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((g) => {
        const groupItems = items.filter((i) => i.group === g);
        if (!groupItems.length) return null;
        return (
          <div key={g}>
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-muted">{g}</div>
            <ul className="space-y-0.5">
              {groupItems.map((i) => (
                <li key={i.to}>
                  <Link
                    to={i.to}
                    onClick={onNavigate}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    activeProps={{ className: "bg-sidebar-accent !text-sidebar-accent-foreground font-medium shadow-[inset_3px_0_0_var(--sidebar-primary)]" }}
                  >
                    <i.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{i.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="border-b border-sidebar-border px-5 py-5"><Brand /></div>
      <SidebarNav onNavigate={onNavigate} />
      <div className="border-t border-sidebar-border px-5 py-4 text-[11px] text-sidebar-muted">Management System · v0.1</div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { profile, user, roles, signOut } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const name = profile?.full_name || user?.email || "User";
  const initials = name.split(/[\s@]/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block"><SidebarBody /></aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-none p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur md:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="font-display text-sm font-bold tracking-wide text-primary lg:hidden">TOBADDY AGRO</div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild aria-label="Notifications">
              <Link to="/notifications"><Bell className="h-5 w-5" /></Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 hover:bg-muted">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{initials}</span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-medium leading-tight">{name}</span>
                  <span className="block text-xs text-muted-foreground">{roles.map((r) => ROLE_LABELS[r]).join(", ") || "No role"}</span>
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/settings">Settings</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
