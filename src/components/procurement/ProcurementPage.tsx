
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  ClipboardList,
  ShoppingCart,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatNaira } from "@/lib/access";
import { PageHeader, RequirePermission } from "@/components/app/PageKit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Section = "suppliers" | "requests" | "orders" | "received";

type Supplier = {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

type Purchase = {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  spent_on: string;
  reference: string | null;
  status: string;
  supplier_id: string | null;
  created_at: string;
};

type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  quantity_on_hand: number;
  unit_cost: number | null;
};

type StockTransaction = {
  id: string;
  item_id: string;
  quantity: number;
  transaction_type: string;
  occurred_at: string;
  reference: string | null;
  supplier_id: string | null;
  unit_cost: number | null;
  notes: string | null;
};

const naira = (value: number) => formatNaira(Number(value) || 0);

function ProcurementContent() {
  const { user, can } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can("procurement.manage") || can("finance.manage");

  const [section, setSection] = useState<Section>("suppliers");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [supplierDialog, setSupplierDialog] = useState(false);
  const [purchaseDialog, setPurchaseDialog] = useState(false);
  const [receivedDialog, setReceivedDialog] = useState(false);

  const [supplierForm, setSupplierForm] = useState({
    name: "",
    category: "Feed supplier",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  const [purchaseForm, setPurchaseForm] = useState({
    supplier_id: "",
    description: "",
    amount: "",
    category: "Farm supplies",
    reference: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const [receivedForm, setReceivedForm] = useState({
    supplier_id: "",
    item_id: "",
    quantity: "",
    unit_cost: "",
    reference: "",
    notes: "",
  });

  const suppliersQuery = useQuery({
    queryKey: ["procurement-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Supplier[];
    },
  });

  const purchasesQuery = useQuery({
    queryKey: ["procurement-purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("spent_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Purchase[];
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["procurement-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as InventoryItem[];
    },
  });

  const transactionsQuery = useQuery({
    queryKey: ["procurement-received"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_transactions")
        .select("*")
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StockTransaction[];
    },
  });

  const suppliers = suppliersQuery.data ?? [];
  const purchases = purchasesQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const transactions = transactionsQuery.data ?? [];

  const supplierNames = new Map(
    suppliers.map((supplier) => [supplier.id, supplier.name]),
  );
  const itemNames = new Map(items.map((item) => [item.id, item.name]));

  const filteredSuppliers = suppliers.filter((supplier) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      supplier.name.toLowerCase().includes(term) ||
      (supplier.phone ?? "").toLowerCase().includes(term) ||
      (supplier.category ?? "").toLowerCase().includes(term)
    );
  });

  const filteredPurchases = purchases.filter((purchase) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      (purchase.description ?? "").toLowerCase().includes(term) ||
      (purchase.reference ?? "").toLowerCase().includes(term) ||
      (supplierNames.get(purchase.supplier_id ?? "") ?? "")
        .toLowerCase()
        .includes(term) ||
      purchase.status.toLowerCase().includes(term)
    );
  });

  const filteredTransactions = transactions.filter((transaction) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      (itemNames.get(transaction.item_id) ?? "").toLowerCase().includes(term) ||
      (transaction.reference ?? "").toLowerCase().includes(term) ||
      (transaction.notes ?? "").toLowerCase().includes(term)
    );
  });

  const loading =
    suppliersQuery.isLoading ||
    purchasesQuery.isLoading ||
    itemsQuery.isLoading ||
    transactionsQuery.isLoading;

  const queryError =
    suppliersQuery.error ||
    purchasesQuery.error ||
    itemsQuery.error ||
    transactionsQuery.error;

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["procurement-suppliers"] }),
      queryClient.invalidateQueries({ queryKey: ["procurement-purchases"] }),
      queryClient.invalidateQueries({ queryKey: ["procurement-inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["procurement-received"] }),
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] }),
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] }),
    ]);
  }

  async function saveSupplier() {
    if (!canManage) {
      alert("You do not have permission to manage suppliers.");
      return;
    }
    if (!supplierForm.name.trim()) {
      alert("Enter the supplier's name.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("suppliers").insert({
        name: supplierForm.name.trim(),
        category: supplierForm.category || null,
        phone: supplierForm.phone.trim() || null,
        email: supplierForm.email.trim() || null,
        address: supplierForm.address.trim() || null,
        notes: supplierForm.notes.trim() || null,
      });
      if (error) throw error;

      setSupplierDialog(false);
      setSupplierForm({
        name: "",
        category: "Feed supplier",
        phone: "",
        email: "",
        address: "",
        notes: "",
      });
      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not save supplier.");
    } finally {
      setSaving(false);
    }
  }

  async function savePurchase() {
    if (!canManage) {
      alert("You do not have permission to record purchase requests.");
      return;
    }

    const amount = Number(purchaseForm.amount);
    if (!purchaseForm.description.trim()) {
      alert("Enter a description of what the farm needs.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter an estimated amount greater than zero.");
      return;
    }

    setSaving(true);
    try {
      const reference =
        purchaseForm.reference.trim() ||
        `PR-${Date.now().toString().slice(-8)}`;

      const { error } = await supabase.from("expenses").insert({
        amount,
        category: purchaseForm.category,
        description: purchaseForm.description.trim(),
        supplier_id: purchaseForm.supplier_id || null,
        reference,
        spent_on: purchaseForm.date,
        recorded_by: user?.id ?? null,
        status: "pending",
      });
      if (error) throw error;

      setPurchaseDialog(false);
      setPurchaseForm({
        supplier_id: "",
        description: "",
        amount: "",
        category: "Farm supplies",
        reference: "",
        date: new Date().toISOString().slice(0, 10),
      });
      await refresh();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Could not save purchase request.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function approvePurchase(purchase: Purchase) {
    if (!can("finance.approve") && !can("settings.manage")) {
      alert("You do not have permission to approve purchase requests.");
      return;
    }
    if (purchase.status !== "pending") return;

    try {
      const { error } = await supabase
        .from("expenses")
        .update({
          status: "approved",
          approved_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", purchase.id)
        .eq("status", "pending");

      if (error) throw error;
      await refresh();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Could not approve the request.",
      );
    }
  }

  async function saveReceived() {
    if (!canManage) {
      alert("You do not have permission to record goods received.");
      return;
    }

    const item = items.find((entry) => entry.id === receivedForm.item_id);
    const quantity = Number(receivedForm.quantity);
    const unitCost = receivedForm.unit_cost.trim()
      ? Number(receivedForm.unit_cost)
      : null;

    if (!item) {
      alert("Select an inventory item.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert("Enter a quantity greater than zero.");
      return;
    }
    if (
      unitCost !== null &&
      (!Number.isFinite(unitCost) || unitCost < 0)
    ) {
      alert("Enter a valid unit cost.");
      return;
    }

    setSaving(true);
    try {
      const reference =
        receivedForm.reference.trim() ||
        `GR-${Date.now().toString().slice(-8)}`;

      const { error: transactionError } = await supabase
        .from("inventory_transactions")
        .insert({
          item_id: item.id,
          quantity,
          transaction_type: "in",
          supplier_id: receivedForm.supplier_id || null,
          unit_cost: unitCost,
          reference,
          notes: receivedForm.notes.trim() || "Goods received",
          performed_by: user?.id ?? null,
          occurred_at: new Date().toISOString(),
        });

      if (transactionError) throw transactionError;

      const { error: itemError } = await supabase
        .from("inventory_items")
        .update({
          quantity_on_hand: Number(item.quantity_on_hand) + quantity,
          unit_cost: unitCost ?? item.unit_cost,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (itemError) {
        alert(
          "The goods-received transaction was saved, but the stock quantity could not be updated. Contact your administrator before retrying to avoid duplicate entries.",
        );
        throw itemError;
      }

      setReceivedDialog(false);
      setReceivedForm({
        supplier_id: "",
        item_id: "",
        quantity: "",
        unit_cost: "",
        reference: "",
        notes: "",
      });
      await refresh();
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message);
      }
    } finally {
      setSaving(false);
    }
  }

  const tabs: {
    id: Section;
    label: string;
    icon: typeof Users;
  }[] = [
    { id: "suppliers", label: "Suppliers", icon: Users },
    { id: "requests", label: "Purchase Requests", icon: ClipboardList },
    { id: "orders", label: "Purchase Orders", icon: ShoppingCart },
    { id: "received", label: "Goods Received", icon: PackageCheck },
  ];

  return (
    <RequirePermission perm="procurement.view">
      <div className="space-y-6">
        <PageHeader
          title="Suppliers & Procurement"
          description="Manage suppliers, purchasing and deliveries for the farm."
          actions={
            <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          }
        />

        {queryError && (
          <div className="rounded-lg border border-destructive/40 p-4 text-sm">
            Could not load procurement data:{" "}
            {queryError instanceof Error ? queryError.message : "Try refreshing."}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Suppliers" value={String(suppliers.length)} icon={Users} />
          <SummaryCard
            title="Pending Requests"
            value={String(purchases.filter((p) => p.status === "pending").length)}
            icon={ClipboardList}
          />
          <SummaryCard
            title="Approved Purchases"
            value={naira(
              purchases
                .filter((p) => p.status === "approved")
                .reduce((sum, p) => sum + Number(p.amount), 0),
            )}
            icon={ShoppingCart}
          />
          <SummaryCard title="Goods Received Records" value={String(transactions.length)} icon={PackageCheck} />
        </div>

        <div className="flex flex-wrap gap-2 border-b pb-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={section === tab.id ? "default" : "outline"}
                onClick={() => {
                  setSection(tab.id);
                  setSearch("");
                }}
              >
                <Icon className="mr-2 h-4 w-4" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={`Search ${section === "suppliers" ? "suppliers" : section === "received" ? "goods received" : "purchases"}...`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {canManage && section === "suppliers" && (
            <Button
              onClick={() => {
                setSupplierForm({
                  name: "",
                  category: "Feed supplier",
                  phone: "",
                  email: "",
                  address: "",
                  notes: "",
                });
                setSupplierDialog(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Supplier
            </Button>
          )}

          {canManage && (section === "requests" || section === "orders") && (
            <Button
              onClick={() => {
                setPurchaseForm({
                  supplier_id: "",
                  description: "",
                  amount: "",
                  category: "Farm supplies",
                  reference: "",
                  date: new Date().toISOString().slice(0, 10),
                });
                setPurchaseDialog(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {section === "requests" ? "New Purchase Request" : "Record Purchase"}
            </Button>
          )}

          {canManage && section === "received" && (
            <Button
              onClick={() => {
                setReceivedForm({
                  supplier_id: "",
                  item_id: "",
                  quantity: "",
                  unit_cost: "",
                  reference: "",
                  notes: "",
                });
                setReceivedDialog(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Record Goods Received
            </Button>
          )}
        </div>

        {loading ? (
          <div className="rounded-xl border p-10 text-center text-muted-foreground">
            Loading procurement data...
          </div>
        ) : (
          <>
            {section === "suppliers" && (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3">Supplier</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map((supplier) => (
                      <tr key={supplier.id} className="border-t">
                        <td className="p-3 font-medium">{supplier.name}</td>
                        <td className="p-3">{supplier.category || "—"}</td>
                        <td className="p-3">{supplier.phone || "—"}</td>
                        <td className="p-3">{supplier.email || "—"}</td>
                        <td className="p-3">{supplier.address || "—"}</td>
                      </tr>
                    ))}
                    {filteredSuppliers.length === 0 && (
                      <EmptyRow columns={5} message="No suppliers found. Add your first supplier." />
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {(section === "requests" || section === "orders") && (
              <>
                <p className="text-xs text-muted-foreground">
                  These records use the existing expenses table. Requests start as pending; approved records are shown under Purchase Orders. They are not separate formal purchase-order records yet.
                </p>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3">Reference</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Supplier</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPurchases
                        .filter((purchase) =>
                          section === "requests"
                            ? purchase.status === "pending"
                            : purchase.status === "approved",
                        )
                        .map((purchase) => (
                          <tr key={purchase.id} className="border-t">
                            <td className="p-3">{purchase.reference || "—"}</td>
                            <td className="p-3">{purchase.description || purchase.category}</td>
                            <td className="p-3">{supplierNames.get(purchase.supplier_id ?? "") || "—"}</td>
                            <td className="p-3">{purchase.spent_on}</td>
                            <td className="p-3">{naira(Number(purchase.amount))}</td>
                            <td className="p-3 capitalize">{purchase.status}</td>
                            <td className="p-3">
                              {section === "requests" &&
                                purchase.status === "pending" &&
                                (can("finance.approve") || can("settings.manage")) && (
                                  <Button size="sm" onClick={() => void approvePurchase(purchase)}>
                                    Approve
                                  </Button>
                                )}
                            </td>
                          </tr>
                        ))}
                      {filteredPurchases.filter((purchase) =>
                        section === "requests"
                          ? purchase.status === "pending"
                          : purchase.status === "approved",
                      ).length === 0 && (
                        <EmptyRow
                          columns={7}
                          message={section === "requests" ? "No pending purchase requests." : "No approved purchases yet."}
                        />
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {section === "received" && (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3">Item</th>
                      <th className="p-3">Supplier</th>
                      <th className="p-3">Quantity</th>
                      <th className="p-3">Unit cost</th>
                      <th className="p-3">Reference</th>
                      <th className="p-3">Received date</th>
                      <th className="p-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction) => (
                      <tr key={transaction.id} className="border-t">
                        <td className="p-3 font-medium">{itemNames.get(transaction.item_id) || "Unknown item"}</td>
                        <td className="p-3">{supplierNames.get(transaction.supplier_id ?? "") || "—"}</td>
                        <td className="p-3">{transaction.quantity}</td>
                        <td className="p-3">{transaction.unit_cost == null ? "—" : naira(transaction.unit_cost)}</td>
                        <td className="p-3">{transaction.reference || "—"}</td>
                        <td className="p-3">{new Date(transaction.occurred_at).toLocaleDateString()}</td>
                        <td className="p-3">{transaction.notes || "—"}</td>
                      </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <EmptyRow columns={7} message="No inventory transactions found." />
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <Dialog open={supplierDialog} onOpenChange={setSupplierDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Supplier</DialogTitle>
              <DialogDescription>Enter the supplier's contact details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Field label="Supplier name *">
                <Input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
              </Field>
              <Field label="Category">
                <Select value={supplierForm.category} onValueChange={(value) => setSupplierForm({ ...supplierForm, category: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Feed supplier">Feed supplier</SelectItem>
                    <SelectItem value="Livestock supplier">Livestock supplier</SelectItem>
                    <SelectItem value="Veterinary supplier">Veterinary supplier</SelectItem>
                    <SelectItem value="Equipment supplier">Equipment supplier</SelectItem>
                    <SelectItem value="Transport">Transport</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Phone">
                <Input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
              </Field>
              <Field label="Address">
                <Input value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} />
              </Field>
              <Field label="Notes">
                <Textarea value={supplierForm.notes} onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })} />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSupplierDialog(false)}>Cancel</Button>
              <Button onClick={() => void saveSupplier()} disabled={saving}>{saving ? "Saving..." : "Save Supplier"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={purchaseDialog} onOpenChange={setPurchaseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Purchase Request</DialogTitle>
              <DialogDescription>Record what the farm needs to purchase. Requests start as pending approval.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Field label="Description *">
                <Textarea value={purchaseForm.description} onChange={(e) => setPurchaseForm({ ...purchaseForm, description: e.target.value })} placeholder="For example, 10 bags of poultry feed" />
              </Field>
              <Field label="Supplier">
                <Select value={purchaseForm.supplier_id || "none"} onValueChange={(value) => setPurchaseForm({ ...purchaseForm, supplier_id: value === "none" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Supplier not selected</SelectItem>
                    {suppliers.map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Category">
                <Select value={purchaseForm.category} onValueChange={(value) => setPurchaseForm({ ...purchaseForm, category: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Farm supplies">Farm supplies</SelectItem>
                    <SelectItem value="Animal feed">Animal feed</SelectItem>
                    <SelectItem value="Veterinary care">Veterinary care</SelectItem>
                    <SelectItem value="Livestock purchase">Livestock purchase</SelectItem>
                    <SelectItem value="Equipment">Equipment</SelectItem>
                    <SelectItem value="Repairs and maintenance">Repairs and maintenance</SelectItem>
                    <SelectItem value="Other expenses">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Estimated amount (₦) *">
                <Input type="number" min="1" value={purchaseForm.amount} onChange={(e) => setPurchaseForm({ ...purchaseForm, amount: e.target.value })} />
              </Field>
              <Field label="Request date">
                <Input type="date" value={purchaseForm.date} onChange={(e) => setPurchaseForm({ ...purchaseForm, date: e.target.value })} />
              </Field>
              <Field label="Reference (optional)">
                <Input value={purchaseForm.reference} onChange={(e) => setPurchaseForm({ ...purchaseForm, reference: e.target.value })} placeholder="Auto-generated if blank" />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPurchaseDialog(false)}>Cancel</Button>
              <Button onClick={() => void savePurchase()} disabled={saving}>{saving ? "Saving..." : "Save Request"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={receivedDialog} onOpenChange={setReceivedDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Goods Received</DialogTitle>
              <DialogDescription>This records an incoming inventory transaction and increases the selected item's stock quantity.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Field label="Inventory item *">
                <Select value={receivedForm.item_id} onValueChange={(value) => setReceivedForm({ ...receivedForm, item_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Select inventory item" /></SelectTrigger>
                  <SelectContent>
                    {items.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} — stock: {item.quantity_on_hand} {item.unit}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Supplier">
                <Select value={receivedForm.supplier_id || "none"} onValueChange={(value) => setReceivedForm({ ...receivedForm, supplier_id: value === "none" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Supplier not selected</SelectItem>
                    {suppliers.map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Quantity received *">
                <Input type="number" min="0.01" step="any" value={receivedForm.quantity} onChange={(e) => setReceivedForm({ ...receivedForm, quantity: e.target.value })} />
              </Field>
              <Field label="Unit cost (₦)">
                <Input type="number" min="0" step="any" value={receivedForm.unit_cost} onChange={(e) => setReceivedForm({ ...receivedForm, unit_cost: e.target.value })} />
              </Field>
              <Field label="Delivery reference">
                <Input value={receivedForm.reference} onChange={(e) => setReceivedForm({ ...receivedForm, reference: e.target.value })} placeholder="Delivery note or invoice number" />
              </Field>
              <Field label="Notes">
                <Textarea value={receivedForm.notes} onChange={(e) => setReceivedForm({ ...receivedForm, notes: e.target.value })} />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReceivedDialog(false)}>Cancel</Button>
              <Button onClick={() => void saveReceived()} disabled={saving || items.length === 0}>{saving ? "Saving..." : "Save Goods Received"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RequirePermission>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{title}</p>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="mt-3 text-xl font-bold">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function EmptyRow({ columns, message }: { columns: number; message: string }) {
  return (
    <tr>
      <td colSpan={columns} className="p-8 text-center text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}

export default function ProcurementPage() {
  return <ProcurementContent />;
}

