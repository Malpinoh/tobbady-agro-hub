import { Sprout } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold text-gold-foreground">
        <Sprout className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <div className={cn("font-display text-[15px] font-extrabold tracking-wide", tone === "light" ? "text-sidebar-foreground" : "text-foreground")}>
          TOBADDY AGRO
        </div>
        <div className={cn("text-[10px] font-semibold uppercase tracking-[0.22em]", tone === "light" ? "text-sidebar-primary" : "text-primary")}>
          Livestock
        </div>
      </div>
    </div>
  );
}
