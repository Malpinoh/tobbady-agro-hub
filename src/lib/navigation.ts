import {
  LayoutDashboard, Crown, ClipboardList, Tractor, Beef, Wallet, ShoppingCart,
  Package, Truck, Users, BarChart3, Bell, Settings, type LucideIcon,
} from "lucide-react";
import type { PermissionKey } from "./access";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: PermissionKey;
  group: "Overview" | "Offices" | "Operations" | "Commerce" | "Administration";
};

/** Single source of truth for sidebar + page access. */
export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view", group: "Overview" },
  { to: "/ceo-office", label: "CEO Office", icon: Crown, permission: "ceo.view", group: "Offices" },
  { to: "/secretary-office", label: "Secretary Office", icon: ClipboardList, permission: "secretary.view", group: "Offices" },
  { to: "/farm-operations", label: "Farm Operations", icon: Tractor, permission: "farm.view", group: "Operations" },
  { to: "/livestock", label: "Livestock", icon: Beef, permission: "livestock.view", group: "Operations" },
  { to: "/inventory", label: "Inventory", icon: Package, permission: "inventory.view", group: "Operations" },
  { to: "/finance", label: "Finance", icon: Wallet, permission: "finance.view", group: "Commerce" },
  { to: "/sales", label: "Sales & Customers", icon: ShoppingCart, permission: "sales.view", group: "Commerce" },
  { to: "/procurement", label: "Suppliers & Procurement", icon: Truck, permission: "procurement.view", group: "Commerce" },
  { to: "/staff", label: "Staff & Users", icon: Users, permission: "staff.view", group: "Administration" },
  { to: "/reports", label: "Reports & Analytics", icon: BarChart3, permission: "reports.view", group: "Administration" },
  { to: "/notifications", label: "Notifications", icon: Bell, permission: "notifications.view", group: "Administration" },
  { to: "/settings", label: "Settings", icon: Settings, permission: "settings.view", group: "Administration" },
];

export const NAV_GROUPS = ["Overview", "Offices", "Operations", "Commerce", "Administration"] as const;
