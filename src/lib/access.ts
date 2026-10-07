import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABELS: Record<AppRole, string> = {
  ceo: "CEO",
  secretary: "Secretary",
  farm_manager: "Farm Manager",
  accountant: "Accountant",
  sales_officer: "Sales Officer",
  storekeeper: "Storekeeper",
  farm_worker: "Farm Worker",
  administrator: "Administrator",
};

export const ALL_ROLES = Object.keys(ROLE_LABELS) as AppRole[];

/** Permission keys mirror the `permissions` table. */
export type PermissionKey =
  | "dashboard.view"
  | "ceo.view"
  | "secretary.view"
  | "farm.view"
  | "livestock.view"
  | "finance.view"
  | "sales.view"
  | "inventory.view"
  | "procurement.view"
  | "staff.view"
  | "users.manage"
  | "reports.view"
  | "notifications.view"
  | "settings.view"
  | "settings.manage"
  | "audit.view"
  | (string & {});

export const formatNaira = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

export const formatCompactNaira = (n: number) =>
  "₦" + new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 }).format(n);
