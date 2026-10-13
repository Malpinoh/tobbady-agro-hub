import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, BookOpen, LogOut, Menu } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Brand } from "./Brand";
import { NAV_GROUPS, NAV_ITEMS } from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/access";
import { useAuth } from "@/hooks/use-auth";

const TOUR_KEY = "tobbady-platform-tour-dismissed-v1";
const TOUR_STEPS = [
  { title: "Welcome to TOBADDY AGRO LIVESTOCK", body: "This system connects farm operations, livestock, inventory, procurement, sales, finance and management reporting. The figures should agree because they describe the same farm activity." },
  { title: "Start with Farm Operations and Livestock", body: "Keep the farm profile and livestock setup accurate. Register individual animals or batches, maintain their current status and quantity, and use the correct farm or open-compound location." },
  { title: "Record purchases and stock movements", body: "Use Suppliers & Procurement to record purchases and confirm goods received. Use Inventory for feed, medicine and supplies. Receive or issue stock once only; rejected or cancelled transactions should not increase stock." },
  { title: "Record sales and expenses in the right place", body: "Record animal sales in Sales & Customers, not as a second manual income entry. Record expenses in Finance and follow the approval and payment statuses. Partial customer payments are not the same as the full sale value." },
  { title: "Use reports and offices to monitor the farm", body: "Dashboard is the quick overview; Reports & Analytics is for date-based review; CEO Office is for oversight; Secretary Office supports records and follow-ups. Use the Operations Guide for role-specific responsibilities. You can reopen this tour from your profile menu." },
];

function SidebarNav({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { can, hasRole } = useAuth();
  const isExecutive = hasRole("ceo") || hasRole("administrator");
  const [showSecretaryOffice, setShowSecretaryOffice] = useState(false);
  const items = NAV_ITEMS.filter(
    (i) =>
      can(i.permission) &&
      (i.to !== "/secretary-office" || !isExecutive || showSecretaryOffice),
  );
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
            {g === "Offices" && isExecutive && can("secretary.view") && (
              <button
                type="button"
                onClick={() => setShowSecretaryOffice((shown) => !shown)}
                aria-expanded={showSecretaryOffice}
                className="mt-2 w-full rounded-md px-3 py-2 text-left text-xs font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                {showSecretaryOffice ? "Hide Secretary Office" : "Show Secretary Office"}
              </button>
            )}
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
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const { profile, user, roles, signOut } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const name = profile?.full_name || user?.email || "User";
  const initials = name.split(/[\s@]/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(TOUR_KEY)) setTourOpen(true);
    } catch {
      // The tour still works when browser storage is unavailable.
    }
  }, []);

  function dismissTour() {
    setTourOpen(false);
    try { window.localStorage.setItem(TOUR_KEY, "dismissed"); } catch { /* optional preference */ }
  }

  function replayTour() {
    setTourStep(0);
    setTourOpen(true);
  }

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  const currentTourStep = TOUR_STEPS[tourStep];

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
                <DropdownMenuItem onClick={replayTour}><BookOpen className="mr-2 h-4 w-4" />Take website tour</DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/operations-guide">Operations Guide</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/settings">Settings</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>

      <Dialog open={tourOpen} onOpenChange={(shown) => { if (!shown) dismissTour(); else setTourOpen(true); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><BookOpen className="h-4 w-4" /> Website guide · Step {tourStep + 1} of {TOUR_STEPS.length}</div>
            <DialogTitle className="text-xl">{currentTourStep.title}</DialogTitle>
            <DialogDescription className="leading-6">{currentTourStep.body}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-1.5" aria-label="Tour progress">
            {TOUR_STEPS.map((step, index) => <div key={step.title} className={`h-1.5 flex-1 rounded-full ${index <= tourStep ? "bg-primary" : "bg-muted"}`} />)}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={dismissTour}>Skip tour</Button>
            <Button onClick={() => tourStep === TOUR_STEPS.length - 1 ? dismissTour() : setTourStep((step) => step + 1)}>
              {tourStep === TOUR_STEPS.length - 1 ? "Finish tour" : "Next"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
