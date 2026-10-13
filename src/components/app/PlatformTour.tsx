import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Compass, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOUR_KEY = "tobbady-platform-spotlight-tour-v2";

type TourStep = {
  target: string;
  eyebrow: string;
  title: string;
  body: string;
  tip: string;
  group: string;
};

const STEPS: TourStep[] = [
  { target: "tour-main", eyebrow: "Welcome aboard", title: "One farm, connected records", body: "TOBADDY AGRO LIVESTOCK brings day-to-day farm work, stock, sales and management records together. Each module owns a different part of the workflow, so record an activity once and verify it in the related summaries.", tip: "Use Next to see where each feature lives. You can skip at any time.", group: "Getting started" },
  { target: "nav-dashboard", eyebrow: "Overview", title: "Dashboard", body: "Start here for a quick view of farm activity, key totals and alerts. Dashboard cards are summaries, not the place to correct a transaction.", tip: "If a number looks wrong, open the module that created the record and inspect its status and date.", group: "Getting started" },
  { target: "nav-operations-guide", eyebrow: "Help & training", title: "Operations Guide", body: "Open the Operations Guide for fuller step-by-step explanations and role-specific responsibilities for the CEO, Secretary and Administrator. Use it when you need instructions beyond this quick tour.", tip: "You can return to this guide from the sidebar or your profile menu.", group: "Getting started" },
  { target: "nav-farm-operations", eyebrow: "Farm setup", title: "Farm Operations", body: "Maintain the farm profile and operational location details. An animal can be assigned to a named section or described as being in an open compound when that matches your real setup.", tip: "Keep location descriptions practical and up to date; do not create a fake section just to fill a field.", group: "Farm & livestock" },
  { target: "nav-livestock", eyebrow: "Farm & livestock", title: "Livestock records", body: "Use this area to manage individual animals and supported livestock batches. Records should reflect the animal or batch's real status, quantities and lifecycle events.", tip: "When an animal is sold, dies or is transferred, confirm the active stock count changes correctly.", group: "Farm & livestock" },
  { target: "nav-livestock-setup", eyebrow: "Farm & livestock", title: "Livestock Setup", body: "Manage the livestock categories, types and breeds available for farm records. Configuration affects how new animals can be entered and reported.", tip: "Avoid removing a type or breed that existing records depend on. Ask an administrator to check dependencies first.", group: "Farm & livestock" },
  { target: "nav-inventory", eyebrow: "Stock control", title: "Inventory", body: "Track feed, medicines and other supplies, including available quantities and low-stock levels. Stock should move through recorded receipts and issues so there is an audit trail.", tip: "A purchase order is not the same as goods received. Record each physical stock movement once only.", group: "Stock & money" },
  { target: "nav-procurement", eyebrow: "Stock & money", title: "Suppliers & Procurement", body: "Use procurement to record supplier purchasing and follow the order/receipt process supported by the page. Only confirm quantities that were actually delivered.", tip: "After receiving goods, check the inventory item quantity before entering another adjustment.", group: "Stock & money" },
  { target: "nav-sales", eyebrow: "Stock & money", title: "Sales & Customers", body: "Create customer sales and track the full sale value separately from the amount paid. A partially paid sale has an outstanding balance; it is not fully paid just because the invoice exists.", tip: "For livestock sales, confirm the individual animal or batch quantity is reduced or marked sold as appropriate.", group: "Stock & money" },
  { target: "nav-finance", eyebrow: "Stock & money", title: "Finance", body: "Review income and expenses and pay attention to their statuses. Recorded, approved and paid expenses can be different measures, so compare like with like.", tip: "Sales should flow through Sales & Customers. Do not create a second manual income entry for the same sale.", group: "Stock & money" },
  { target: "nav-reports", eyebrow: "Review & decisions", title: "Reports & Analytics", body: "Use reports to review activity across a chosen date range. Sales value, cash received, outstanding customer balances, expenses and profit are related but different measures.", tip: "When comparing reports with the Dashboard or CEO Office, use the same period and status definitions.", group: "Review & decisions" },
  { target: "nav-ceo-office", eyebrow: "Review & decisions", title: "CEO Office", body: "The CEO uses this area for oversight, approvals and management decisions available to their role. Decisions should be based on source records and supporting evidence.", tip: "Investigate unusual figures instead of entering a duplicate transaction to make totals appear equal.", group: "Review & decisions" },
  { target: "nav-secretary-office", eyebrow: "Review & decisions", title: "Secretary Office", body: "The Secretary Office supports management coordination, records and follow-ups. Availability depends on your assigned role and permissions.", tip: "Keep action owners, decisions and follow-up evidence clear so nothing gets lost.", group: "Review & decisions" },
  { target: "nav-board-documents", eyebrow: "Review & decisions", title: "Board Documents", body: "Use the documents area for authorised management or board records and supporting material. Follow your organisation's approval and record-keeping process.", tip: "Keep documents connected to the decision or action they support.", group: "Review & decisions" },
  { target: "nav-staff", eyebrow: "People & controls", title: "Staff & Users", body: "Staff and user tools help authorised administrators manage who can access the system. Access should match each person's job responsibilities.", tip: "Give users only the permissions they need, and review access when responsibilities change.", group: "People & controls" },
  { target: "nav-notifications", eyebrow: "People & controls", title: "Notifications", body: "Check notifications for system updates or items that may need your attention. Follow through to the relevant module to investigate and resolve the underlying issue.", tip: "A notification is a prompt to review something, not a substitute for checking the source record.", group: "People & controls" },
  { target: "nav-settings", eyebrow: "People & controls", title: "Settings", body: "Settings contains system options available to your role. Some configuration or maintenance actions can affect other users, so only use them when authorised and understood.", tip: "Never use a reset or test-data action on real farm records. Preserve production history and audit trails.", group: "People & controls" },
  { target: "tour-profile", eyebrow: "Keep learning", title: "Replay the tour or open the guide", body: "You can restart this walkthrough from your profile menu and open the Operations Guide for fuller instructions and role-specific checklists for the CEO, Secretary and Administrator.", tip: "The menu and pages you can open depend on your permissions. Missing items may be hidden intentionally.", group: "Finish" },
];

type Rect = { x: number; y: number; width: number; height: number };

function isVisible(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
}

export function PlatformTour({ onOpenNavigation }: { onOpenNavigation?: () => void }) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const step = STEPS[stepIndex];

  const locateTarget = useCallback(() => {
    if (!open) return;
    const candidates = Array.from(document.querySelectorAll(`[data-tour="${step.target}"]`));
    let target = candidates.find(isVisible) ?? null;
    if (!target && step.target.startsWith("nav-") && window.innerWidth < 1024) {
      onOpenNavigation?.();
      // On small screens the sidebar lives in a sheet; wait for it to mount,
      // then measure the real link instead of highlighting a guessed point.
      window.setTimeout(() => {
        const selector = `[data-tour="${step.target}"]`;
        const refreshed = Array.from(document.querySelectorAll(selector)).find(isVisible);
        if (!refreshed) return;
        refreshed.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        const r = refreshed.getBoundingClientRect();
        const pad = 7;
        setRect({ x: Math.max(6, r.left - pad), y: Math.max(6, r.top - pad), width: Math.min(window.innerWidth - 12, r.width + pad * 2), height: Math.min(window.innerHeight - 12, r.height + pad * 2) });
        setViewport({ width: window.innerWidth, height: window.innerHeight });
      }, 220);
      return;
    }
    if (!target) target = document.querySelector("[data-tour='tour-main']") as HTMLElement | null;
    if (!target || !isVisible(target)) {
      setRect(null);
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    const r = target.getBoundingClientRect();
    const pad = 7;
    setRect({ x: Math.max(6, r.left - pad), y: Math.max(6, r.top - pad), width: Math.min(window.innerWidth - 12, r.width + pad * 2), height: Math.min(window.innerHeight - 12, r.height + pad * 2) });
    setViewport({ width: window.innerWidth, height: window.innerHeight });
  }, [open, step.target, onOpenNavigation]);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(TOUR_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(locateTarget);
    const resize = () => locateTarget();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", resize, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", resize, true);
    };
  }, [open, stepIndex, locateTarget]);

  const finish = useCallback(() => {
    setOpen(false);
    try { window.localStorage.setItem(TOUR_KEY, "dismissed"); } catch { /* optional preference */ }
  }, []);

  const replay = useCallback(() => {
    setStepIndex(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    const handler = () => replay();
    window.addEventListener("tobbady:replay-tour", handler);
    return () => window.removeEventListener("tobbady:replay-tour", handler);
  }, [replay]);

  // Keep the controls in a predictable, reachable dock instead of positioning
  // them from a guessed tooltip height (which could push buttons off-screen).
  // The highlighted target remains visible above/behind the dock.
  const tooltipStyle = useMemo(() => ({
    position: "fixed" as const,
    left: "50%",
    bottom: "max(12px, env(safe-area-inset-bottom))",
    transform: "translateX(-50%)",
    width: "min(420px, calc(100vw - 24px))",
    maxHeight: "min(560px, calc(100dvh - 24px))",
    overflowY: "auto" as const,
    overscrollBehavior: "contain" as const,
    zIndex: 110,
  }), []);

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <defs><mask id="tobbady-tour-mask"><rect width="100%" height="100%" fill="white" />{rect && <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx="12" fill="black" />}</mask></defs>
        <rect width="100%" height="100%" fill="rgba(8, 18, 12, .72)" mask="url(#tobbady-tour-mask)" />
        {rect && <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx="12" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" />}
      </svg>
      {rect && <div className="pointer-events-none absolute rounded-xl ring-4 ring-primary/20" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} />}
      <section role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-description" className="pointer-events-auto fixed rounded-2xl border bg-card p-4 text-card-foreground shadow-2xl sm:p-5" style={tooltipStyle}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-primary"><Compass className="h-4 w-4" />{step.eyebrow}</div>
          <button type="button" onClick={finish} aria-label="Close tour" className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{stepIndex + 1} / {STEPS.length}</span>
          <span className="text-xs text-muted-foreground">{step.group}</span>
        </div>
        <h2 id="tour-title" className="text-lg font-semibold tracking-tight">{step.title}</h2>
        <p id="tour-description" className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm leading-5"><span className="font-semibold text-primary">Practical tip: </span>{step.tip}</div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} /></div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={finish}>Skip tour</Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => Math.max(0, i - 1))}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
            {stepIndex === STEPS.length - 1
              ? <Button size="sm" onClick={finish}>Finish <Check className="ml-1 h-4 w-4" /></Button>
              : <Button size="sm" onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}>Next <ArrowRight className="ml-1 h-4 w-4" /></Button>}
          </div>
        </div>
      </section>
    </div>
  );
}
