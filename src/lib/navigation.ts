import {
  LayoutDashboard, Crown, ClipboardList, Tractor, Beef, Wallet, ShoppingCart,
  Package, Truck, Users, BarChart3, Bell, Settings, Tags, FileUp, BookOpen, type LucideIcon,
} from "lucide-react";
import type { PermissionKey } from "./access";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: PermissionKey;
  group: "Main" | "Offices" | "Farm" | "Sales & Money" | "Management";
};

/** Single source of truth for sidebar + page access. */
export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view", group: "Main" },
  { to: "/operations-guide", label: "How to Use the System", icon: BookOpen, permission: "dashboard.view", group: "Main" },
  { to: "/ceo-office", label: "CEO Office", icon: Crown, permission: "ceo.view", group: "Offices" },
  { to: "/secretary-office", label: "Secretary Office", icon: ClipboardList, permission: "secretary.view", group: "Offices" },
  { to: "/board-documents", label: "Management Documents", icon: FileUp, permission: "documents.manage", group: "Offices" },
  { to: "/farm-operations", label: "Farm Setup", icon: Tractor, permission: "farm.view", group: "Farm" },
  { to: "/livestock", label: "Livestock", icon: Beef, permission: "livestock.view", group: "Farm" },
  { to: "/livestock-config", label: "Animal Types & Breeds", icon: Tags, permission: "livestock.config.manage", group: "Farm" },
  { to: "/inventory", label: "Feed, Medicine & Supplies", icon: Package, permission: "inventory.view", group: "Farm" },
  { to: "/finance", label: "Income & Expenses", icon: Wallet, permission: "finance.view", group: "Sales & Money" },
  { to: "/sales", label: "Sales & Customers", icon: ShoppingCart, permission: "sales.view", group: "Sales & Money" },
  { to: "/procurement", label: "Suppliers & Purchases", icon: Truck, permission: "procurement.view", group: "Sales & Money" },
  { to: "/staff", label: "Staff Accounts", icon: Users, permission: "staff.view", group: "Management" },
  { to: "/reports", label: "Reports", icon: BarChart3, permission: "reports.view", group: "Management" },
  { to: "/notifications", label: "Notifications", icon: Bell, permission: "notifications.view", group: "Management" },
  { to: "/settings", label: "Settings", icon: Settings, permission: "settings.view", group: "Management" },
];

export const NAV_GROUPS = ["Main", "Offices", "Farm", "Sales & Money", "Management"] as const;
